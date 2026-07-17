import fs from 'node:fs/promises';
import path from 'node:path';
import { getUuid } from '@/lib/hash';
import { envConfigs } from '@/config';
import { getAllConfigs } from '@/modules/config/service';
import { consume, getBalance } from '@/modules/credits/service';

/**
 * AI-rendered EE diagram engine (gpt-image style, via a relay endpoint).
 * Relay contract (async task):
 *   POST {base}/images/generations {model, prompt, n, size, resolution}
 *     → { data: [{ task_id, status: 'submitted' }] }
 *   GET  {base}/tasks/{task_id}
 *     → { data: { progress: 0-100, result: { images: [{ url: [..] }] } } }
 * Result URLs expire (~24h), so the image is downloaded into GENERATED_DIR
 * and served from our own origin via /api/files/generated/$name.
 */

const DEFAULT_IMAGE_COST = 10;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 240_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ImageApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function getImageApiConfig(): Promise<ImageApiConfig> {
  const configs = await getAllConfigs();
  const baseUrl =
    (configs.image_api_base_url as string) || process.env.IMAGE_API_BASE_URL || '';
  const apiKey = (configs.image_api_key as string) || process.env.IMAGE_API_KEY || '';
  const model =
    (configs.image_api_model as string) || process.env.IMAGE_API_MODEL || 'gpt-image-2';
  if (!baseUrl || !apiKey) {
    throw new Error('Image API is not configured — set it in /admin/settings → AI');
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

export async function getDiagramImageCost(): Promise<number> {
  const configs = await getAllConfigs();
  const raw = Number.parseInt((configs.ee_diagram_image_cost_credits as string) || '', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_IMAGE_COST;
}

/**
 * Cookbook-style prompting: the user's description IS the artifact spec and
 * is passed through nearly verbatim (gpt-image responds best to a direct
 * brief). We append only a thin layer of invariants: label language, clean
 * flat diagram style, and one conditional hint for electronics subjects.
 */
function buildImagePrompt(description: string, language: string): string {
  const lang = language === 'zh' ? 'Chinese (part numbers stay in English)' : 'English';
  return [
    description.slice(0, 1500),
    '',
    'Requirements:',
    `- Render it as a clean diagram; all label text in ${lang}, crisp and legible.`,
    '- Clean flat technical-diagram style: white background, thin lines, restrained color palette.',
    '- If (and only if) the subject is an electronics system, follow standard EE block-diagram conventions: power/inputs left, controller center, outputs/communication right, arrows labeled with rails and interfaces, dashed lines for feedback/alert.',
    '- No watermark, no decoration, no text beyond the diagram\'s own labels.',
  ].join('\n');
}

async function submitTask(cfg: ImageApiConfig, prompt: string): Promise<string> {
  const response = await fetch(`${cfg.baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, prompt, n: 1, size: '4:3', resolution: '2k' }),
  });
  const json = (await response.json()) as {
    code?: number;
    message?: string;
    data?: Array<{ task_id?: string }>;
  };
  const taskId = json.data?.[0]?.task_id;
  if (!response.ok || !taskId) {
    throw new Error(json.message || `Image API submit failed (${response.status})`);
  }
  return taskId;
}

async function pollTask(cfg: ImageApiConfig, taskId: string, signal?: AbortSignal): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Canceled');
    await sleep(POLL_INTERVAL_MS);
    const response = await fetch(`${cfg.baseUrl}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    const json = (await response.json()) as {
      data?: {
        progress?: number;
        status?: string;
        error?: { message?: string };
        result?: { images?: Array<{ url?: string[] }> };
      };
    };
    const data = json.data;
    if (data?.error?.message) throw new Error(`Image generation failed: ${data.error.message}`);
    const url = data?.result?.images?.[0]?.url?.[0];
    if ((data?.progress ?? 0) >= 100 && url) return url;
  }
  throw new Error('Image generation timed out');
}

/**
 * Download the (expiring) remote image and persist it under GENERATED_DIR,
 * served through /api/files/generated/$name (nitro's static handler only
 * serves the build-time public/ snapshot, so runtime files need a route).
 */
async function persistImage(remoteUrl: string): Promise<string> {
  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`Image download failed (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = envConfigs.generated_dir;
  await fs.mkdir(dir, { recursive: true });
  const basename = `ee-diagram-${getUuid()}`;
  await fs.writeFile(path.join(dir, `${basename}.png`), buffer);
  // Extensionless URL — see the /api/files/generated/$name route.
  return `/api/files/generated/${basename}`;
}

export async function generateEeDiagramImage(params: {
  userId: string;
  description: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<{ url: string; costCredits: number }> {
  const { userId, description, language = 'zh', signal } = params;

  const cfg = await getImageApiConfig();
  const costCredits = await getDiagramImageCost();
  if (costCredits > 0 && (await getBalance(userId)) < costCredits) {
    throw new Error('Insufficient credits');
  }

  const taskId = await submitTask(cfg, buildImagePrompt(description, language));
  const remoteUrl = await pollTask(cfg, taskId, signal);
  const url = await persistImage(remoteUrl);

  if (costCredits > 0) {
    const consumed = await consume({
      userId,
      credits: costCredits,
      scene: 'ee_diagram',
      description: `EE diagram image: ${description.slice(0, 80)}`,
      metadata: JSON.stringify({ taskId }),
    });
    if (!consumed.success) throw new Error('Insufficient credits');
  }

  return { url, costCredits };
}
