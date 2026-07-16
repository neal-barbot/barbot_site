import { and, asc, count, desc, eq, isNull, like, or, type SQL } from 'drizzle-orm';
import { getUuid } from '@/lib/hash';
import { db } from '@/core/db';
import {
  bom,
  chip,
  chipSegment,
  pin2pin,
  type Bom,
  type Chip,
  type ChipSegment,
  type NewChip,
  type Pin2Pin,
} from '@/config/db/schema';

export type SearchMode = 'exact' | 'fuzzy';

/** Normalize a part number for matching: uppercase, strip spaces/dashes. */
export function normalizePartNumber(partNumber: string): string {
  return partNumber.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export async function searchChips(params: {
  keyword: string;
  mode?: SearchMode;
  page?: number;
  pageSize?: number;
}) {
  const { keyword, mode = 'fuzzy', page = 1, pageSize = 10 } = params;
  const offset = (page - 1) * pageSize;
  const norm = normalizePartNumber(keyword);

  let where: SQL | undefined;
  if (keyword.trim()) {
    where =
      mode === 'exact'
        ? eq(chip.partNumberNorm, norm)
        : or(
            like(chip.partNumberNorm, `%${norm}%`),
            like(chip.manufacturer, `%${keyword.trim()}%`),
            like(chip.description, `%${keyword.trim()}%`)
          );
  }

  const [totalResult] = await db().select({ count: count() }).from(chip).where(where);
  const items = await db()
    .select()
    .from(chip)
    .where(where)
    .orderBy(asc(chip.partNumber))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalResult.count };
}

export interface ChipDetail {
  chip: Chip;
  segment: ChipSegment | null;
  substitutes: Pin2Pin[];
  bomItems: Bom[];
}

export async function getChipDetail(id: string): Promise<ChipDetail | null> {
  const [found] = await db().select().from(chip).where(eq(chip.id, id)).limit(1);
  if (!found) return null;

  const [segment] = found.segmentId
    ? await db().select().from(chipSegment).where(eq(chipSegment.id, found.segmentId)).limit(1)
    : [null];
  const substitutes = await db().select().from(pin2pin).where(eq(pin2pin.chipId, id));
  const bomItems = await db().select().from(bom).where(eq(bom.chipId, id));

  return { chip: found, segment: segment ?? null, substitutes, bomItems };
}

export async function getChipByPartNumber(partNumber: string): Promise<Chip | null> {
  const [found] = await db()
    .select()
    .from(chip)
    .where(eq(chip.partNumberNorm, normalizePartNumber(partNumber)))
    .limit(1);
  return found ?? null;
}

export async function getPin2PinByPartNumber(partNumber: string): Promise<Pin2Pin[]> {
  return db().select().from(pin2pin).where(eq(pin2pin.partNumber, partNumber.trim()));
}

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

export async function listChips(params: {
  search?: string;
  segmentId?: string;
  page?: number;
  pageSize?: number;
}) {
  const { search, segmentId, page = 1, pageSize = 10 } = params;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [];
  if (search?.trim()) {
    conditions.push(
      or(
        like(chip.partNumberNorm, `%${normalizePartNumber(search)}%`),
        like(chip.manufacturer, `%${search.trim()}%`)
      )!
    );
  }
  if (segmentId) conditions.push(eq(chip.segmentId, segmentId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db().select({ count: count() }).from(chip).where(where);
  const items = await db()
    .select()
    .from(chip)
    .where(where)
    .orderBy(desc(chip.updatedAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalResult.count };
}

export interface ChipInput {
  manufacturer?: string | null;
  partNumber: string;
  description?: string | null;
  sheetUrl?: string | null;
  parameter?: string | null;
  segmentId?: string | null;
}

export async function createChip(input: ChipInput): Promise<Chip> {
  const [created] = await db()
    .insert(chip)
    .values({
      id: getUuid(),
      manufacturer: input.manufacturer ?? null,
      partNumber: input.partNumber.trim(),
      partNumberNorm: normalizePartNumber(input.partNumber),
      description: input.description ?? null,
      sheetUrl: input.sheetUrl ?? null,
      parameter: input.parameter ?? null,
      segmentId: input.segmentId ?? null,
    })
    .returning();
  return created;
}

export async function updateChip(id: string, input: Partial<ChipInput>): Promise<Chip | null> {
  const values: Partial<NewChip> = {};
  if (input.manufacturer !== undefined) values.manufacturer = input.manufacturer;
  if (input.partNumber !== undefined) {
    values.partNumber = input.partNumber.trim();
    values.partNumberNorm = normalizePartNumber(input.partNumber);
  }
  if (input.description !== undefined) values.description = input.description;
  if (input.sheetUrl !== undefined) values.sheetUrl = input.sheetUrl;
  if (input.parameter !== undefined) values.parameter = input.parameter;
  if (input.segmentId !== undefined) values.segmentId = input.segmentId;

  const [updated] = await db().update(chip).set(values).where(eq(chip.id, id)).returning();
  return updated ?? null;
}

export async function deleteChip(id: string): Promise<void> {
  await db().delete(chip).where(eq(chip.id, id));
}

// ─── CSV import ──────────────────────────────────────────────────────────────

export interface ChipCsvRow {
  manufacturer?: string;
  partNumber: string;
  description?: string;
  sheetUrl?: string;
  parameter?: string;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function importChipsCsv(rows: ChipCsvRow[]): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (const [i, row] of rows.entries()) {
    const partNumber = row.partNumber?.trim();
    if (!partNumber) {
      result.skipped += 1;
      result.errors.push(`Row ${i + 1}: missing part number`);
      continue;
    }

    try {
      const norm = normalizePartNumber(partNumber);
      const manufacturer = row.manufacturer?.trim() || null;
      const existingRows = await db()
        .select({ id: chip.id, manufacturer: chip.manufacturer })
        .from(chip)
        .where(eq(chip.partNumberNorm, norm));
      const existing = existingRows.find(
        (r: { id: string; manufacturer: string | null }) => (r.manufacturer ?? null) === manufacturer
      );

      const values = {
        manufacturer,
        partNumber,
        partNumberNorm: norm,
        description: row.description?.trim() || null,
        sheetUrl: row.sheetUrl?.trim() || null,
        parameter: row.parameter?.trim() || null,
      };

      if (existing) {
        await db().update(chip).set(values).where(eq(chip.id, existing.id));
        result.updated += 1;
      } else {
        await db().insert(chip).values({ id: getUuid(), ...values });
        result.inserted += 1;
      }
    } catch (error) {
      result.skipped += 1;
      result.errors.push(
        `Row ${i + 1} (${partNumber}): ${error instanceof Error ? error.message : 'import failed'}`
      );
    }
  }

  return result;
}

// ─── Segments ────────────────────────────────────────────────────────────────

export interface SegmentNode extends ChipSegment {
  children: ChipSegment[];
}

export async function listSegments(): Promise<SegmentNode[]> {
  const all: ChipSegment[] = await db()
    .select()
    .from(chipSegment)
    .orderBy(asc(chipSegment.sort));
  const majors = all.filter((s: ChipSegment) => !s.parentId);
  return majors.map((major: ChipSegment) => ({
    ...major,
    children: all.filter((s: ChipSegment) => s.parentId === major.id),
  }));
}

export async function createSegment(input: {
  name: string;
  description?: string | null;
  parentId?: string | null;
  sort?: number;
}): Promise<ChipSegment> {
  if (input.parentId) {
    const [parent] = await db()
      .select()
      .from(chipSegment)
      .where(and(eq(chipSegment.id, input.parentId), isNull(chipSegment.parentId)))
      .limit(1);
    if (!parent) {
      throw new Error('Parent segment not found or is not a top-level segment');
    }
  }

  const [created] = await db()
    .insert(chipSegment)
    .values({
      id: getUuid(),
      name: input.name.trim(),
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      sort: input.sort ?? 0,
    })
    .returning();
  return created;
}

export async function updateSegment(
  id: string,
  input: { name?: string; description?: string | null; sort?: number }
): Promise<ChipSegment | null> {
  const values: Partial<ChipSegment> = {};
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.description !== undefined) values.description = input.description;
  if (input.sort !== undefined) values.sort = input.sort;

  const [updated] = await db()
    .update(chipSegment)
    .set(values)
    .where(eq(chipSegment.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteSegment(id: string): Promise<void> {
  await db().transaction(async (tx: any) => {
    await tx.update(chip).set({ segmentId: null }).where(eq(chip.segmentId, id));
    await tx.delete(chipSegment).where(eq(chipSegment.parentId, id));
    await tx.delete(chipSegment).where(eq(chipSegment.id, id));
  });
}

// ─── Pin2Pin / BOM ───────────────────────────────────────────────────────────

export async function addPin2Pin(input: {
  chipId: string;
  supplier?: string | null;
  partNumber: string;
  supplierP2p?: string | null;
  partNumberP2p: string;
}): Promise<Pin2Pin> {
  const [created] = await db()
    .insert(pin2pin)
    .values({
      id: getUuid(),
      chipId: input.chipId,
      supplier: input.supplier ?? null,
      partNumber: input.partNumber.trim(),
      supplierP2p: input.supplierP2p ?? null,
      partNumberP2p: input.partNumberP2p.trim(),
    })
    .returning();
  return created;
}

export async function deletePin2Pin(id: string): Promise<void> {
  await db().delete(pin2pin).where(eq(pin2pin.id, id));
}

export async function addBomItem(input: {
  chipId: string;
  manufacturer?: string | null;
  categoryName?: string | null;
  partNumber: string;
  quantity?: number;
  unitPrice?: number;
}): Promise<Bom> {
  const quantity = input.quantity ?? 1;
  const unitPrice = input.unitPrice ?? 0;
  const [created] = await db()
    .insert(bom)
    .values({
      id: getUuid(),
      chipId: input.chipId,
      manufacturer: input.manufacturer ?? null,
      categoryName: input.categoryName ?? null,
      partNumber: input.partNumber.trim(),
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
    })
    .returning();
  return created;
}

export async function deleteBomItem(id: string): Promise<void> {
  await db().delete(bom).where(eq(bom.id, id));
}
