import { promises as fs } from 'node:fs';
import path from 'node:path';

import { envConfigs } from '@/config';
import { askPiAgentForWiki, PiAgentExecutionError } from '@/lib/pi-agent';

export type WikiContextType = 'concept' | 'source' | 'output';

export interface WikiContextItem {
  id: string;
  type: WikiContextType;
  title: string;
  summary: string;
  path: string;
  updated?: string;
  imageCount: number;
  images: Array<{
    name: string;
    url: string;
  }>;
}

export interface WikiAnswer {
  answer: string;
  contextMarkdown: string;
  trace?: {
    id: string;
    path: string;
  };
  citations: Array<{
    title: string;
    path: string;
  }>;
}

export interface WikiFocusContext {
  imageName?: string;
  mode?: string;
  selection?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

const WIKI_TYPES: Record<WikiContextType, string> = {
  concept: 'concepts',
  source: 'sources',
  output: 'outputs',
};

function wikiRoot() {
  return envConfigs.neal_wiki_root;
}

function wikiDir() {
  return path.join(wikiRoot(), 'wiki');
}

function toTitle(filename: string) {
  return filename.replace(/\.md$/i, '').replace(/-/g, ' ');
}

function stripFrontmatter(content: string) {
  return content.replace(/^---[\s\S]*?---\s*/m, '').trim();
}

function frontmatterValue(content: string, key: string) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.replace(/^["'`]|["'`]$/g, '').trim();
}

function firstHeading(content: string) {
  return stripFrontmatter(content).match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function firstParagraph(content: string) {
  const body = stripFrontmatter(content)
    .replace(/^#+\s+.+$/gm, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !line.startsWith('|') && !line.startsWith('- ') && !line.startsWith('>'));

  return body?.slice(0, 180) ?? '';
}

function safeContextPath(type: WikiContextType, filename: string) {
  const base = path.join(wikiDir(), WIKI_TYPES[type]);
  const resolved = path.resolve(base, filename);
  if (!resolved.startsWith(path.resolve(base) + path.sep)) {
    throw new Error('Invalid wiki context path');
  }
  return resolved;
}

function parseContextId(id: string): { type: WikiContextType; filename: string } {
  const [type, ...rest] = id.split('/');
  if (!type || !(type in WIKI_TYPES) || rest.length === 0) {
    throw new Error('Invalid context id');
  }
  return { type: type as WikiContextType, filename: rest.join('/') };
}

function rawPathForSource(content: string) {
  const source = frontmatterValue(content, 'source');
  if (!source || !source.startsWith('raw/')) return null;
  return path.join(wikiRoot(), source);
}

async function imagesForSource(content: string, contextId: string) {
  const rawPath = rawPathForSource(content);
  if (!rawPath) return [];

  try {
    const entries = await fs.readdir(rawPath);
    return Promise.all(
      entries
        .filter((entry) => /\.(png|jpe?g|webp|gif)$/i.test(entry))
        .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
        .slice(0, 8)
        .map(async (entry) => {
          const stat = await fs.stat(path.join(rawPath, entry));
          return {
            name: entry,
            url: `/api/wiki/asset?contextId=${encodeURIComponent(contextId)}&name=${encodeURIComponent(entry)}&v=${Math.round(stat.mtimeMs)}`,
          };
        })
    );
  } catch {
    return [];
  }
}

function traceRoot() {
  return path.join(wikiRoot(), 'traces', 'wiki-assistant');
}

function traceId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function saveWikiTrace(params: {
  question: string;
  contextMarkdown: string;
  answer: string;
  rawStdout: string;
  rawStderr: string;
  citations: WikiAnswer['citations'];
  focus?: WikiFocusContext;
  status: 'success' | 'error';
  error?: string;
  exitCode?: number;
}) {
  const id = traceId();
  const dir = path.join(traceRoot(), id);
  await fs.mkdir(dir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(dir, 'context.md'), params.contextMarkdown, 'utf8'),
    fs.writeFile(path.join(dir, 'agent-stdout.md'), params.rawStdout || params.answer, 'utf8'),
    fs.writeFile(path.join(dir, 'agent-stderr.log'), params.rawStderr, 'utf8'),
    fs.writeFile(
      path.join(dir, 'meta.json'),
      JSON.stringify(
        {
          id,
          createdAt: new Date().toISOString(),
          status: params.status,
          error: params.error ?? null,
          exitCode: params.exitCode ?? null,
          question: params.question,
          focus: params.focus ?? null,
          citations: params.citations,
        },
        null,
        2
      ),
      'utf8'
    ),
  ]);

  return {
    id,
    path: dir,
  };
}

export async function listWikiContexts(): Promise<WikiContextItem[]> {
  const items = await Promise.all(
    (Object.entries(WIKI_TYPES) as Array<[WikiContextType, string]>).map(async ([type, dir]) => {
      const fullDir = path.join(wikiDir(), dir);
      const files = await fs.readdir(fullDir).catch(() => []);

      return Promise.all(
        files
          .filter((file) => file.endsWith('.md'))
          .map(async (file) => {
            const fullPath = path.join(fullDir, file);
            const content = await fs.readFile(fullPath, 'utf8');
            const updated =
              frontmatterValue(content, 'last_updated') ??
              frontmatterValue(content, 'date') ??
              undefined;

            const id = `${type}/${file}`;
            const images = type === 'source' ? await imagesForSource(content, id) : [];
            return {
              id,
              type,
              title: frontmatterValue(content, 'title') ?? firstHeading(content) ?? toTitle(file),
              summary: firstParagraph(content),
              path: `wiki/${dir}/${file}`,
              updated,
              imageCount: images.length,
              images,
            };
          })
      );
    })
  );

  return items
    .flat()
    .sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title, 'zh-CN'));
}

export async function readWikiAsset(params: {
  contextId: string;
  name: string;
}) {
  const source = await readWikiContext(params.contextId);
  if (source.type !== 'source') {
    throw new Error('Only source contexts can expose assets');
  }

  const rawPath = rawPathForSource(source.content);
  if (!rawPath) throw new Error('Source does not reference a raw directory');

  const resolved = path.resolve(rawPath, params.name);
  if (!resolved.startsWith(path.resolve(rawPath) + path.sep)) {
    throw new Error('Invalid asset path');
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/png';

  return {
    bytes: await fs.readFile(resolved),
    contentType,
  };
}

export async function readWikiContext(id: string) {
  const { type, filename } = parseContextId(id);
  const content = await fs.readFile(safeContextPath(type, filename), 'utf8');
  return {
    id,
    type,
    title: frontmatterValue(content, 'title') ?? firstHeading(content) ?? toTitle(filename),
    path: `wiki/${WIKI_TYPES[type]}/${filename}`,
    content,
  };
}

export async function askWiki(params: {
  question: string;
  contextIds: string[];
  focus?: WikiFocusContext;
}): Promise<WikiAnswer> {
  const selected = await Promise.all(params.contextIds.slice(0, 8).map((id) => readWikiContext(id)));
  const contexts = selected.length > 0 ? selected : (await listWikiContexts()).slice(0, 3);
  const loaded =
    contexts.length === 0
      ? []
      : 'content' in contexts[0]
        ? contexts
        : await Promise.all(contexts.map((item) => readWikiContext(item.id)));

  const contextMarkdown = [
    '# context.md',
    '',
    '## User Focus',
    `Mode: ${params.focus?.mode ?? 'diagram_focus'}`,
    params.focus?.imageName ? `Image: ${params.focus.imageName}` : 'Image: not specified',
    params.focus?.selection
      ? `Selection: x=${params.focus.selection.x}, y=${params.focus.selection.y}, width=${params.focus.selection.width}, height=${params.focus.selection.height}`
      : 'Selection: none',
    '',
    '## Question',
    `Question: ${params.question}`,
    '',
    '## Source Context',
    ...loaded.map((item, index) => [
      `## Context ${index + 1}: ${item.title}`,
      `Path: ${item.path}`,
      '',
      stripFrontmatter(item.content).slice(0, 4500),
      '',
    ].join('\n')),
  ].join('\n');

  const citations = loaded.map((item) => ({ title: item.title, path: item.path }));
  let result;

  try {
    result = await askPiAgentForWiki({
      question: params.question,
      contextMarkdown,
    });
  } catch (error) {
    if (error instanceof PiAgentExecutionError) {
      const trace = await saveWikiTrace({
        question: params.question,
        contextMarkdown,
        answer: error.result.answer,
        rawStdout: error.result.rawStdout,
        rawStderr: error.result.rawStderr,
        citations,
        focus: params.focus,
        status: 'error',
        error: error.message,
        exitCode: error.result.exitCode,
      });
      throw new Error(`${error.message} (trace: ${trace.path})`);
    }

    throw error;
  }

  const trace = await saveWikiTrace({
    question: params.question,
    contextMarkdown,
    answer: result.answer,
    rawStdout: result.rawStdout,
    rawStderr: result.rawStderr,
    citations,
    focus: params.focus,
    status: 'success',
    exitCode: result.exitCode,
  });

  return {
    answer: result.answer,
    contextMarkdown,
    trace,
    citations,
  };
}
