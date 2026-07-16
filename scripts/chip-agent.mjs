#!/usr/bin/env node
/**
 * Chip P2P heavy-task agent runner — Claude Agent SDK on DeepSeek's
 * Anthropic-compatible endpoint.
 *
 * Handles one-sentence batch tasks like:
 *   node scripts/chip-agent.mjs "抓取这个 URL 的 datasheet 并导入: https://..."
 *   node scripts/chip-agent.mjs "把 ./pdfs 目录下所有 PDF 批量导入"
 *   node scripts/chip-agent.mjs "对比 STM32F103C8T6 和 GD32F103C8T6，发一篇博客草稿"
 *
 * Env (falls back to .env.development):
 *   CHIP_AGENT_API_KEY   — API key from /settings/apikeys (Bearer auth to the app)
 *   DEEPSEEK_API_KEY     — DeepSeek key (drives the agent loop)
 *   CHIP_AGENT_APP_URL   — app base URL (default http://localhost:3000)
 *   CHIP_AGENT_MODEL     — default deepseek-v4-flash
 */
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

// ── config ───────────────────────────────────────────────────────────────────
function loadEnvFile(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    // optional
  }
}
loadEnvFile(path.join(process.cwd(), '.env.development'));

const APP_URL = process.env.CHIP_AGENT_APP_URL || 'http://localhost:3000';
const APP_KEY = process.env.CHIP_AGENT_API_KEY;
const DS_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.CHIP_AGENT_MODEL || 'deepseek-v4-flash';

const task = process.argv.slice(2).join(' ').trim();
if (!task) {
  console.error('Usage: node scripts/chip-agent.mjs "<task>"');
  process.exit(1);
}
if (!APP_KEY) throw new Error('CHIP_AGENT_API_KEY not set (create one at /settings/apikeys)');
if (!DS_KEY) throw new Error('DEEPSEEK_API_KEY not set');

// Route the Claude Agent SDK to DeepSeek's Anthropic-compatible endpoint.
// ANTHROPIC_API_KEY outranks any locally stored credential/profile, so set it
// explicitly in the child env (DeepSeek accepts x-api-key auth).
const agentEnv = {
  ...process.env,
  ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  ANTHROPIC_API_KEY: DS_KEY,
  ANTHROPIC_MODEL: MODEL,
  ANTHROPIC_SMALL_FAST_MODEL: MODEL,
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
};
delete agentEnv.ANTHROPIC_AUTH_TOKEN;
delete agentEnv.ANTHROPIC_PROFILE;

// ── app API helpers ──────────────────────────────────────────────────────────
async function api(pathname, init = {}) {
  const response = await fetch(`${APP_URL}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${APP_KEY}`, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    if (json.code !== 0) throw new Error(json.message || 'API error');
    return json.data;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 200)}`);
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── custom tools (wired to the app's REST API) ───────────────────────────────
const chipTools = createSdkMcpServer({
  name: 'chip-p2p',
  version: '1.0.0',
  tools: [
    tool('search_chips', 'Search the chip catalog by part number / manufacturer / description.', {
      keyword: z.string(),
    }, async ({ keyword }) => {
      const data = await api(`/api/chips?keyword=${encodeURIComponent(keyword)}&mode=fuzzy&pageSize=10`);
      return { content: [{ type: 'text', text: JSON.stringify(data.items) }] };
    }),

    tool('import_pdf', 'Import a local PDF datasheet into the platform (parses it immediately). Returns fileMd5 + pageCount. Rate limited — waits 2.5s per call automatically.', {
      filePath: z.string().describe('Absolute path to a PDF file on disk'),
      partNumber: z.string().describe('Chip part number this datasheet belongs to'),
    }, async ({ filePath, partNumber }) => {
      const buffer = fs.readFileSync(filePath);
      const form = new FormData();
      form.append('files', new File([buffer], path.basename(filePath), { type: 'application/pdf' }));
      await sleep(2500); // upload endpoint enforces a 2s min interval
      const data = await api('/api/chip-compare/upload', { method: 'POST', body: form });
      const file = data.files[0];
      return { content: [{ type: 'text', text: JSON.stringify({ ...file, partNumber }) }] };
    }),

    tool('run_compare', 'Run an AI pin-to-pin comparison. parts = catalog part numbers; files = previously imported PDFs ({fileMd5, fileName, partNumber}). 2–10 chips total. Takes 30–90s; consumes credits (cache hits free). Returns recordId and the report.', {
      parts: z.array(z.string()).default([]),
      files: z.array(z.object({ fileMd5: z.string(), fileName: z.string(), partNumber: z.string() })).default([]),
      language: z.string().default('zh'),
    }, async ({ parts, files, language }) => {
      const response = await fetch(`${APP_URL}/api/chip-compare/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${APP_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts, files, language }),
      });
      if (!response.headers.get('content-type')?.includes('event-stream')) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.message || `analyze failed (${response.status})`);
      }
      // Drain the SSE stream; keep recordId and error, discard tokens.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', recordId = null, error = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const data = frame.split('\n').find((l) => l.startsWith('data:'))?.slice(5).trim();
          if (!data) continue;
          try {
            const evt = JSON.parse(data);
            if (evt.recordId) recordId = evt.recordId;
            if (frame.includes('event: error')) error = evt.content;
          } catch { /* ignore */ }
        }
      }
      if (error) throw new Error(error);
      if (!recordId) throw new Error('Compare finished without a record id');
      const record = await api(`/api/chip-compare/records/${recordId}`);
      return { content: [{ type: 'text', text: JSON.stringify({ recordId, status: record.status, report: (record.result ?? '').slice(0, 20000) }) }] };
    }),

    tool('publish_to_blog', 'Publish a comparison record report as a blog article.', {
      recordId: z.string(),
      title: z.string(),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      description: z.string().default(''),
      status: z.enum(['draft', 'published']).default('draft'),
    }, async ({ recordId, ...body }) => {
      const data = await api(`/api/chip-compare/records/${recordId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    }),

    tool('list_records', 'List my recent comparison records.', {}, async () => {
      const data = await api('/api/chip-compare/records?pageSize=20');
      return { content: [{ type: 'text', text: JSON.stringify(data.items) }] };
    }),
  ],
});

// ── run ──────────────────────────────────────────────────────────────────────
const SYSTEM = [
  'You are a batch-task agent for a chip pin-to-pin comparison platform.',
  'Capabilities: download datasheet PDFs with Bash (curl -L, always set a browser User-Agent), then import them with import_pdf; batch-import local PDF folders (Glob → import_pdf one by one); run comparisons; publish reports to the blog.',
  'Rules: verify each PDF downloaded is a real PDF (file size > 10KB, `file` says PDF) before importing. Import PDFs sequentially, never in parallel. Use language "zh" for reports unless asked otherwise. Blog publishes default to draft status.',
  'Report progress concisely; when done, summarize what was imported/compared/published with ids.',
].join('\n');

console.log(`[chip-agent] model=${MODEL} app=${APP_URL}\n[task] ${task}\n`);

for await (const message of query({
  prompt: task,
  options: {
    systemPrompt: SYSTEM,
    mcpServers: { 'chip-p2p': chipTools },
    allowedTools: [
      'Bash', 'Glob', 'Read', 'WebFetch', 'WebSearch',
      'mcp__chip-p2p__search_chips', 'mcp__chip-p2p__import_pdf',
      'mcp__chip-p2p__run_compare', 'mcp__chip-p2p__publish_to_blog',
      'mcp__chip-p2p__list_records',
    ],
    permissionMode: 'bypassPermissions',
    maxTurns: 40,
    env: agentEnv,
  },
})) {
  if (message.type === 'assistant') {
    for (const block of message.message.content) {
      if (block.type === 'text') process.stdout.write(block.text + '\n');
      else if (block.type === 'tool_use') console.log(`  ▸ ${block.name}(${JSON.stringify(block.input).slice(0, 140)})`);
    }
  } else if (message.type === 'result') {
    console.log(`\n[done] turns=${message.num_turns} cost_usd=${message.total_cost_usd ?? 'n/a'}`);
    if (message.subtype !== 'success') console.error(`[exit] ${message.subtype}`);
  }
}
