import { z } from 'zod';
import { getAllConfigs } from '@/modules/config/service';
import { consume, getBalance } from '@/modules/credits/service';
import { streamChatCompletion } from './llm';

/**
 * EE block-diagram generation: the LLM emits a structured graph (blocks +
 * labeled edges + functional groups) which the frontend renders as crisp
 * SVG. Structured output beats image models for engineering diagrams —
 * labels are exact text, styling is ours, and the result is editable.
 */

const blockSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  sub: z.string().max(80).nullish(),
  group: z.string().max(30).nullish(),
});

const edgeSchema = z.object({
  from: z.string().min(1).max(40),
  to: z.string().min(1).max(40),
  label: z.string().max(50).nullish(),
  dashed: z.boolean().nullish(),
});

export const diagramSchema = z.object({
  title: z.string().max(120).default(''),
  blocks: z.array(blockSchema).min(2).max(40),
  edges: z.array(edgeSchema).max(80),
});

export type EeDiagram = z.infer<typeof diagramSchema>;

const DEFAULT_DIAGRAM_COST = 5;

export async function getDiagramCost(): Promise<number> {
  const configs = await getAllConfigs();
  const raw = Number.parseInt((configs.ee_diagram_cost_credits as string) || '', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DIAGRAM_COST;
}

function buildDiagramPrompt(description: string, language: string): { system: string; user: string } {
  const system = [
    'You are a senior electronics systems engineer who draws clear EE functional block diagrams.',
    'You output ONLY a JSON object — no markdown, no explanations, no code fences.',
  ].join('\n');

  const user = [
    '为下面的电子系统绘制一张 EE 功能框图（block diagram），输出 JSON：',
    '',
    `系统描述：${description.slice(0, 2000)}`,
    '',
    'JSON 结构：',
    '{"title": "<图题>",',
    ' "blocks": [{"id": "mcu", "label": "STM32F103C8T6", "sub": "Cortex-M3 主控", "group": "主控"}],',
    ' "edges": [{"from": "vin", "to": "ldo", "label": "12V"}, {"from": "mcu", "to": "afe", "label": "SPI", "dashed": false}]}',
    '',
    '绘图规范（EE 惯例）：',
    '- 信号流从左到右：电源输入/接口在最左，主控居中，执行/输出/通信在右',
    '- 每个 block 是一个功能单元（电源、主控、AFE、传感、通信、保护、负载…），label 用真实器件型号或功能名，sub 一句话说明',
    '- group 用中文功能域名称（电源、主控、模拟前端、通信、保护、负载），同域 block 用相同 group',
    '- 每条 edge 标注接口或电气量：电源轨写电压（如 "5V"、"3.3V"），数字接口写协议（SPI / I2C / CAN / UART / isoSPI），模拟信号写信号名',
    '- 反馈/使能/告警类联系用 dashed: true',
    '- block 数量控制在 6–18 个，抓主干，不画旁路小件（去耦电容等）',
    `- 文字语言：${language === 'zh' ? '中文（器件型号保留英文）' : 'English'}`,
    '',
    '只输出 JSON 对象本身。',
  ].join('\n');

  return { system, user };
}

/** Tolerant JSON extraction: raw object, or embedded in a code fence. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateEeDiagram(params: {
  userId: string;
  description: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<{ diagram: EeDiagram; costCredits: number }> {
  const { userId, description, language = 'zh', signal } = params;

  const configs = await getAllConfigs();
  const baseUrl = (configs.openai_base_url as string) || 'https://api.openai.com/v1';
  const apiKey = (configs.openai_api_key as string) || '';
  const model =
    (configs.chip_compare_model as string) || (configs.openai_model as string) || 'gpt-4.1-mini';
  if (!apiKey) {
    throw new Error('LLM is not configured — set the OpenAI API key in /admin/settings → AI');
  }

  const costCredits = await getDiagramCost();
  if (costCredits > 0 && (await getBalance(userId)) < costCredits) {
    throw new Error('Insufficient credits');
  }

  const { system, user } = buildDiagramPrompt(description, language);
  const result = await streamChatCompletion({
    baseUrl,
    apiKey,
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    signal,
  });

  const diagram = diagramSchema.parse(extractJson(result.text));

  // Drop edges pointing at unknown blocks instead of failing the whole run.
  const ids = new Set(diagram.blocks.map((b) => b.id));
  const edges = diagram.edges.filter((e) => ids.has(e.from) && ids.has(e.to));

  if (costCredits > 0) {
    const consumed = await consume({
      userId,
      credits: costCredits,
      scene: 'ee_diagram',
      description: `EE diagram: ${description.slice(0, 80)}`,
    });
    if (!consumed.success) throw new Error('Insufficient credits');
  }

  return { diagram: { ...diagram, edges }, costCredits };
}
