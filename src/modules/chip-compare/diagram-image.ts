import fs from 'node:fs/promises';
import path from 'node:path';
import { getUuid } from '@/lib/hash';
import { getAllConfigs } from '@/modules/config/service';
import { consume, getBalance } from '@/modules/credits/service';

/**
 * AI-rendered EE diagram engine (gpt-image style, via a relay endpoint).
 * Relay contract (async task):
 *   POST {base}/images/generations {model, prompt, n, size, resolution}
 *     → { data: [{ task_id, status: 'submitted' }] }
 *   GET  {base}/tasks/{task_id}
 *     → { data: { progress: 0-100, result: { images: [{ url: [..] }] } } }
 * Result URLs expire (~24h), so the image is downloaded and persisted to
 * public/imgs/generated/ and served from our own origin.
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
 * Cookbook-style prompt (gpt-image infographic / scientific-diagram pattern):
 * name the artifact, define layout conventions, demand clean labeled blocks
 * and readable arrows, forbid decorative noise.
 */
function buildImagePrompt(description: string, language: string): string {
  const lang = language === 'zh' ? 'Chinese (part numbers stay in English)' : 'English';
  return [
    'Create a clean functional block diagram / flow diagram for:',
    description.slice(0, 1500),
    '',
    'Match the diagram conventions to the subject domain:',
    '- Electronics system → EE block diagram: signal flow left to right, power input and',
    '  connectors on the left, main controller in the center, outputs/communication on the',
    '  right; arrows labeled with rails and interfaces (e.g. "5V", "3.3V", "SPI", "CAN");',
    '  dashed arrows for feedback/enable/alert lines.',
    '- Machine or industrial process → stage-by-stage process flow with the real material',
    '  paths (e.g. water path, product path) labeled on the arrows.',
    '- Scientific or biological concept → the domain\'s standard教学 explainer layout:',
    '  stages as blocks in their natural order, molecules/quantities labeled on the arrows.',
    '  Do NOT invent electronic components (MCU, LDO, sensors) unless the subject is electronics.',
    '',
    'Each block is a rounded rectangle with an exact name; related blocks visually clustered',
    'with subtle background tints; clear orthogonal labeled arrows.',
    `All label text in ${lang}. Crisp, legible typography.`,
    'Style: clean technical-documentation diagram on a white background, flat design,',
    'thin lines, restrained color palette.',
    'No decorative illustrations, no 3D effects, no watermark, no extra text.',
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

/** Download the (expiring) remote image and persist it under our origin. */
async function persistImage(remoteUrl: string): Promise<string> {
  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`Image download failed (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = path.join(process.cwd(), 'public', 'imgs', 'generated');
  await fs.mkdir(dir, { recursive: true });
  const filename = `ee-diagram-${getUuid()}.png`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/imgs/generated/${filename}`;
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
