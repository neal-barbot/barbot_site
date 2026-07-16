import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { getUuid, md5 } from '@/lib/hash';
import { db } from '@/core/db';
import {
  chip,
  chipCompareRecord,
  chipCompareTrace,
  type ChipCompareRecord,
  type ChipCompareTrace,
} from '@/config/db/schema';
import { getAllConfigs } from '@/modules/config/service';
import { consume, getBalance } from '@/modules/credits/service';
import {
  getCachedParse,
  parsePdfFromUrl,
  toParsedContent,
  type ParsedPdfContent,
} from './pdf-extract';
import { streamChatCompletion } from './llm';
import { buildComparePrompt, parseTraceBlock, type ParsedTrace } from './prompt';

/** Same normalization as chips/service — duplicated to keep modules independent. */
function normalizePartNumber(partNumber: string): string {
  return partNumber.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export const MIN_CHIPS = 2;
export const MAX_CHIPS = 10;
const DEFAULT_COST_CREDITS = 10;

export type CompareStatus =
  | 'pending'
  | 'parsing'
  | 'analyzing'
  | 'success'
  | 'failed'
  | 'canceled';

export interface CompareEvent {
  type: 'stage' | 'token' | 'message' | 'done' | 'error';
  content: string;
  recordId?: string;
}

export interface CompareFileInput {
  fileMd5: string;
  fileName: string;
  partNumber?: string;
}

export interface CompareInput {
  userId: string;
  /** Catalog part numbers to include (resolved via chip.sheet_url). */
  parts?: string[];
  /** Pre-uploaded PDFs (already parsed into pdf_parse_cache at upload time). */
  files?: CompareFileInput[];
  language?: string;
  userPrompt?: string;
  source?: 'user' | 'preheat';
  consumeCredits?: boolean;
  onEvent?: (event: CompareEvent) => void;
  signal?: AbortSignal;
}

interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function getCompareConfig(): Promise<{ llm: LlmConfig; costCredits: number }> {
  const configs = await getAllConfigs();
  const baseUrl = (configs.openai_base_url as string) || 'https://api.openai.com/v1';
  const apiKey = (configs.openai_api_key as string) || '';
  const model =
    (configs.chip_compare_model as string) || (configs.openai_model as string) || 'gpt-4.1-mini';
  const rawCost = Number.parseInt((configs.chip_compare_cost_credits as string) || '', 10);
  const costCredits = Number.isFinite(rawCost) && rawCost >= 0 ? rawCost : DEFAULT_COST_CREDITS;

  if (!apiKey) {
    throw new Error('LLM is not configured — set the OpenAI API key in /admin/settings → AI');
  }
  return { llm: { baseUrl, apiKey, model }, costCredits };
}

export function buildCacheKey(parts: string[], model: string, language: string): string {
  const normalized = parts.map((p) => normalizePartNumber(p)).sort();
  return md5(`${normalized.join(',')}|${model}|${language}`);
}

export async function getCompareCost(): Promise<number> {
  const configs = await getAllConfigs();
  const raw = Number.parseInt((configs.chip_compare_cost_credits as string) || '', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_COST_CREDITS;
}

async function updateRecord(id: string, values: Record<string, unknown>) {
  await db().update(chipCompareRecord).set(values).where(eq(chipCompareRecord.id, id));
}

/** Resolve every input (catalog part or uploaded file) to parsed datasheet text. */
async function resolveContents(
  input: CompareInput,
  emit: (stage: string) => void
): Promise<Array<{ partNumber: string; content: ParsedPdfContent }>> {
  const resolved: Array<{ partNumber: string; content: ParsedPdfContent }> = [];
  const total = (input.parts?.length ?? 0) + (input.files?.length ?? 0);
  let index = 0;

  for (const partNumber of input.parts ?? []) {
    index += 1;
    emit(`parsing ${index}/${total}: ${partNumber}`);
    const [found] = await db()
      .select()
      .from(chip)
      .where(eq(chip.partNumberNorm, normalizePartNumber(partNumber)))
      .limit(1);
    if (!found) throw new Error(`Chip not found in catalog: ${partNumber}`);
    if (!found.sheetUrl) throw new Error(`Chip ${partNumber} has no datasheet URL`);

    const urlMd5Cached = await getCachedParse(md5(found.sheetUrl));
    if (urlMd5Cached?.status === 'success' && urlMd5Cached.pages) {
      resolved.push({ partNumber: found.partNumber, content: toParsedContent(urlMd5Cached) });
      continue;
    }
    const content = await parsePdfFromUrl({
      url: found.sheetUrl,
      chipPartNumber: found.partNumber,
    });
    resolved.push({ partNumber: found.partNumber, content });
  }

  for (const file of input.files ?? []) {
    index += 1;
    emit(`parsing ${index}/${total}: ${file.fileName}`);
    const cached = await getCachedParse(file.fileMd5);
    if (!cached || cached.status !== 'success' || !cached.pages) {
      throw new Error(`Uploaded file not parsed yet: ${file.fileName} — re-upload it`);
    }
    resolved.push({
      partNumber: file.partNumber || cached.chipPartNumber || file.fileName.replace(/\.pdf$/i, ''),
      content: toParsedContent(cached),
    });
  }

  return resolved;
}

export interface CompareResult {
  recordId: string;
  cacheHit: boolean;
  report: string;
}

export async function runComparePipeline(input: CompareInput): Promise<CompareResult> {
  const {
    userId,
    language = 'en',
    source = 'user',
    consumeCredits = true,
    onEvent = () => {},
    signal,
  } = input;

  const partCount = (input.parts?.length ?? 0) + (input.files?.length ?? 0);
  if (partCount < MIN_CHIPS || partCount > MAX_CHIPS) {
    throw new Error(`Select between ${MIN_CHIPS} and ${MAX_CHIPS} chips to compare`);
  }

  const { llm, costCredits } = await getCompareConfig();
  const partNumbers = [
    ...(input.parts ?? []),
    ...(input.files ?? []).map((f) => f.partNumber || f.fileName.replace(/\.pdf$/i, '')),
  ];

  // Whole-report cache only applies to pure catalog runs (uploads may differ per file).
  const isCatalogOnly = !input.files?.length;
  const cacheKey = isCatalogOnly ? buildCacheKey(partNumbers, llm.model, language) : '';

  if (cacheKey) {
    const [cached] = await db()
      .select()
      .from(chipCompareRecord)
      .where(
        and(
          eq(chipCompareRecord.cacheKey, cacheKey),
          eq(chipCompareRecord.status, 'success'),
          isNull(chipCompareRecord.deletedAt)
        )
      )
      .orderBy(desc(chipCompareRecord.createdAt))
      .limit(1);

    if (cached?.result) {
      const [record] = await db()
        .insert(chipCompareRecord)
        .values({
          id: getUuid(),
          userId,
          chipPartNumbers: JSON.stringify(partNumbers),
          fileList: '[]',
          status: 'success',
          stage: 'cache hit',
          model: llm.model,
          language,
          result: cached.result,
          costCredits: 0,
          cacheKey,
          cacheHit: true,
          source,
        })
        .returning();

      // Copy traces so the cached record is self-contained.
      const cachedTraces = await db()
        .select()
        .from(chipCompareTrace)
        .where(eq(chipCompareTrace.recordId, cached.id));
      if (cachedTraces.length > 0) {
        await db()
          .insert(chipCompareTrace)
          .values(
            cachedTraces.map((t: ChipCompareTrace) => ({
              id: getUuid(),
              recordId: record.id,
              paramName: t.paramName,
              paramCategory: t.paramCategory,
              chipsTrace: t.chipsTrace,
              diffLevel: t.diffLevel,
              diffNote: t.diffNote,
            }))
          );
      }

      onEvent({ type: 'message', content: cached.result, recordId: record.id });
      onEvent({ type: 'done', content: '', recordId: record.id });
      return { recordId: record.id, cacheHit: true, report: cached.result };
    }
  }

  if (consumeCredits && costCredits > 0) {
    const balance = await getBalance(userId);
    if (balance < costCredits) {
      throw new Error(`Insufficient credits: need ${costCredits}, have ${balance}`);
    }
  }

  const [record] = await db()
    .insert(chipCompareRecord)
    .values({
      id: getUuid(),
      userId,
      chipPartNumbers: JSON.stringify(partNumbers),
      fileList: JSON.stringify(input.files ?? []),
      status: 'parsing',
      model: llm.model,
      language,
      prompt: input.userPrompt ?? null,
      costCredits: consumeCredits ? costCredits : 0,
      cacheKey,
      source,
    })
    .returning();

  const startedAt = Date.now();
  const emitStage = (stage: string) => {
    onEvent({ type: 'stage', content: stage, recordId: record.id });
  };

  try {
    const contents = await resolveContents(input, emitStage);
    if (signal?.aborted) throw new Error('Canceled');

    await updateRecord(record.id, { status: 'analyzing', stage: 'analyzing' });
    emitStage('analyzing');

    const { system, user } = buildComparePrompt({
      chips: contents,
      language,
      userPrompt: input.userPrompt,
    });

    const llmResult = await streamChatCompletion({
      ...llm,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      onToken: (delta) => onEvent({ type: 'token', content: delta, recordId: record.id }),
      signal,
    });

    const { report, traces } = parseTraceBlock(llmResult.text);

    await db().transaction(async (tx: any) => {
      let creditId: string | null = null;
      if (consumeCredits && costCredits > 0) {
        const consumeResult = await consume({
          userId,
          credits: costCredits,
          scene: 'chip_compare',
          description: `Chip compare: ${partNumbers.join(' vs ')}`,
          metadata: JSON.stringify({ recordId: record.id }),
          tx,
        });
        if (!consumeResult.success) {
          throw new Error('Insufficient credits');
        }
        creditId = consumeResult.consumedCredit?.id ?? null;
      }

      await tx
        .update(chipCompareRecord)
        .set({
          status: 'success',
          stage: 'done',
          result: report,
          inputTokens: llmResult.inputTokens,
          outputTokens: llmResult.outputTokens,
          durationMs: Date.now() - startedAt,
          creditId,
        })
        .where(eq(chipCompareRecord.id, record.id));

      if (traces.length > 0) {
        await tx.insert(chipCompareTrace).values(
          traces.map((t: ParsedTrace) => ({
            id: getUuid(),
            recordId: record.id,
            paramName: t.paramName,
            paramCategory: t.paramCategory ?? null,
            chipsTrace: JSON.stringify(t.chips),
            diffLevel: t.diffLevel ?? null,
            diffNote: t.diffNote ?? null,
          }))
        );
      }
    });

    onEvent({ type: 'done', content: '', recordId: record.id });
    return { recordId: record.id, cacheHit: false, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compare failed';
    const status: CompareStatus = message === 'Canceled' ? 'canceled' : 'failed';
    await updateRecord(record.id, {
      status,
      error: message,
      durationMs: Date.now() - startedAt,
    });
    onEvent({ type: 'error', content: message, recordId: record.id });
    throw error;
  }
}

// ─── Records ─────────────────────────────────────────────────────────────────

export async function listRecords(params: { userId: string; page?: number; pageSize?: number }) {
  const { userId, page = 1, pageSize = 10 } = params;
  const offset = (page - 1) * pageSize;
  const where = and(eq(chipCompareRecord.userId, userId), isNull(chipCompareRecord.deletedAt));

  const [totalResult] = await db()
    .select({ count: count() })
    .from(chipCompareRecord)
    .where(where);
  const items = await db()
    .select({
      id: chipCompareRecord.id,
      chipPartNumbers: chipCompareRecord.chipPartNumbers,
      status: chipCompareRecord.status,
      stage: chipCompareRecord.stage,
      model: chipCompareRecord.model,
      language: chipCompareRecord.language,
      costCredits: chipCompareRecord.costCredits,
      cacheHit: chipCompareRecord.cacheHit,
      durationMs: chipCompareRecord.durationMs,
      error: chipCompareRecord.error,
      createdAt: chipCompareRecord.createdAt,
    })
    .from(chipCompareRecord)
    .where(where)
    .orderBy(desc(chipCompareRecord.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalResult.count };
}

export async function getRecord(
  id: string,
  userId?: string
): Promise<ChipCompareRecord | null> {
  const conditions: SQL[] = [eq(chipCompareRecord.id, id), isNull(chipCompareRecord.deletedAt)!];
  if (userId) conditions.push(eq(chipCompareRecord.userId, userId));
  const [record] = await db()
    .select()
    .from(chipCompareRecord)
    .where(and(...conditions))
    .limit(1);
  return record ?? null;
}

export async function getTraces(recordId: string, userId?: string): Promise<ChipCompareTrace[]> {
  const record = await getRecord(recordId, userId);
  if (!record) return [];
  return db()
    .select()
    .from(chipCompareTrace)
    .where(eq(chipCompareTrace.recordId, recordId));
}

export async function updateTraceNote(
  traceId: string,
  userId: string,
  note: string
): Promise<boolean> {
  const [trace] = await db()
    .select()
    .from(chipCompareTrace)
    .where(eq(chipCompareTrace.id, traceId))
    .limit(1);
  if (!trace) return false;

  const record = await getRecord(trace.recordId, userId);
  if (!record) return false;

  await db()
    .update(chipCompareTrace)
    .set({ userNote: note })
    .where(eq(chipCompareTrace.id, traceId));
  return true;
}

export async function updateRecordResult(
  id: string,
  userId: string,
  result: string
): Promise<boolean> {
  const record = await getRecord(id, userId);
  if (!record) return false;
  await updateRecord(id, { result });
  return true;
}

export async function deleteRecord(id: string, userId: string): Promise<boolean> {
  const record = await getRecord(id, userId);
  if (!record) return false;
  await updateRecord(id, { deletedAt: new Date() });
  return true;
}

export function exportRecordCsv(traces: ChipCompareTrace[]): string {
  const escape = (v: unknown) => {
    let s = String(v ?? '');
    // Guard against spreadsheet formula injection when the CSV is opened in Excel.
    if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = 'param_name,param_category,chip,value,page,diff_level,diff_note,user_note';
  const rows: string[] = [];
  for (const trace of traces) {
    let chips: Array<{ chip?: string; value?: string; page?: number }> = [];
    try {
      chips = JSON.parse(trace.chipsTrace);
    } catch {
      chips = [];
    }
    if (chips.length === 0) chips = [{}];
    for (const c of chips) {
      rows.push(
        [
          escape(trace.paramName),
          escape(trace.paramCategory),
          escape(c.chip),
          escape(c.value),
          escape(c.page),
          escape(trace.diffLevel),
          escape(trace.diffNote),
          escape(trace.userNote),
        ].join(',')
      );
    }
  }
  return [header, ...rows].join('\n');
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function listAllRecords(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  source?: string;
}) {
  const { page = 1, pageSize = 10, status, source } = params;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [isNull(chipCompareRecord.deletedAt)!];
  if (status) conditions.push(eq(chipCompareRecord.status, status));
  if (source) conditions.push(eq(chipCompareRecord.source, source));
  const where = and(...conditions);

  const [totalResult] = await db()
    .select({ count: count() })
    .from(chipCompareRecord)
    .where(where);
  const items = await db()
    .select({
      id: chipCompareRecord.id,
      userId: chipCompareRecord.userId,
      chipPartNumbers: chipCompareRecord.chipPartNumbers,
      status: chipCompareRecord.status,
      stage: chipCompareRecord.stage,
      model: chipCompareRecord.model,
      language: chipCompareRecord.language,
      costCredits: chipCompareRecord.costCredits,
      cacheHit: chipCompareRecord.cacheHit,
      source: chipCompareRecord.source,
      durationMs: chipCompareRecord.durationMs,
      inputTokens: chipCompareRecord.inputTokens,
      outputTokens: chipCompareRecord.outputTokens,
      error: chipCompareRecord.error,
      createdAt: chipCompareRecord.createdAt,
    })
    .from(chipCompareRecord)
    .where(where)
    .orderBy(desc(chipCompareRecord.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalResult.count };
}

/**
 * Admin preheat: run the pipeline without consuming credits, fire-and-forget.
 * Status is tracked on the record row (source='preheat').
 */
export function preheat(params: {
  adminUserId: string;
  parts: string[];
  language?: string;
}): void {
  void runComparePipeline({
    userId: params.adminUserId,
    parts: params.parts,
    language: params.language ?? 'en',
    source: 'preheat',
    consumeCredits: false,
  }).catch((error) => {
    console.error('Chip compare preheat failed:', error);
  });
}
