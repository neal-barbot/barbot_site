#!/usr/bin/env node
/**
 * Barbot blog publisher — for local Claude Code / Codex agents.
 * Zero dependencies (Node 18+). Publishes or updates a blog article with
 * images in one request, so you never touch the admin UI.
 *
 * Setup (once):
 *   export BARBOT_URL=https://barbot.example.com      # your platform URL
 *   export BARBOT_API_KEY=sk_...                        # from /settings/apikeys
 *
 * Publish from a markdown file with front-matter-free images:
 *   node sdk/barbot-blog.mjs post.md --slug my-post --title "My Post" \
 *     --cover cover.png --image fig1=diagram.png --image fig2=chart.jpg
 *
 * In post.md, reference images by ref:  ![a diagram](fig1)
 * (the ref is rewritten to the uploaded URL server-side).
 *
 * List your articles:
 *   node sdk/barbot-blog.mjs --list
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.BARBOT_URL || 'http://localhost:3000').replace(/\/$/, '');
const KEY = process.env.BARBOT_API_KEY;
if (!KEY) {
  console.error('Set BARBOT_API_KEY (create one at /settings/apikeys).');
  process.exit(1);
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function loadImage(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Unsupported image type: ${file}`);
  return { data: fs.readFileSync(file).toString('base64'), mime };
}

async function api(method, body) {
  const res = await fetch(`${BASE}/api/agent/blog`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data;
}

// ── args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.includes('--list')) {
  const { items } = await api('GET');
  for (const it of items) console.log(`${it.status.padEnd(9)} ${it.slug}  —  ${it.title}`);
  process.exit(0);
}

const positional = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const mdFile = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
function opt(name) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}
function opts(name) {
  return argv.reduce((acc, a, i) => (a === `--${name}` ? [...acc, argv[i + 1]] : acc), []);
}

if (!mdFile) {
  console.error('Usage: node sdk/barbot-blog.mjs <post.md> --slug <s> --title <t> [--cover f] [--image ref=f ...] [--draft]');
  process.exit(1);
}

const body = {
  slug: opt('slug'),
  title: opt('title'),
  description: opt('description'),
  content: fs.readFileSync(mdFile, 'utf8'),
  status: argv.includes('--draft') ? 'draft' : 'published',
  categories: opt('categories'),
  authorName: opt('author'),
};
if (!body.slug || !body.title) {
  console.error('--slug and --title are required.');
  process.exit(1);
}
const cover = opt('cover');
if (cover) body.cover = loadImage(cover);
const images = opts('image').map((pair) => {
  const [ref, file] = pair.split('=');
  if (!ref || !file) throw new Error(`--image expects ref=file, got: ${pair}`);
  return { ref, ...loadImage(file) };
});
if (images.length) body.images = images;

const result = await api('POST', body);
console.log(`${result.updated ? 'Updated' : 'Published'}: ${result.url}  (${result.status})`);
