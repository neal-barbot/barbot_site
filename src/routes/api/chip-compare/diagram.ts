import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { resolveUserId } from '@/modules/apikeys/auth';
import { generateEeDiagram } from '@/modules/chip-compare/diagram';
import { generateEeDiagramImage } from '@/modules/chip-compare/diagram-image';

const bodySchema = z.object({
  description: z.string().min(4).max(2000),
  language: z.string().max(10).default('zh'),
  engine: z.enum(['svg', 'image']).default('svg'),
});

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 3000,
    keyPrefix: 'ee-diagram',
  });
  if (limited) return limited;

  const userId = await resolveUserId(request);
  if (!userId) return respErr('Unauthorized');

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respErr('description is required (4-2000 chars)');
  const { description, language, engine } = parsed.data;

  try {
    if (engine === 'image') {
      const { url, costCredits } = await generateEeDiagramImage({
        userId,
        description,
        language,
        signal: request.signal,
      });
      return respData({ engine, url, costCredits });
    }
    const { diagram, costCredits } = await generateEeDiagram({
      userId,
      description,
      language,
      signal: request.signal,
    });
    return respData({ engine, diagram, costCredits });
  } catch (error) {
    console.error('EE diagram generation failed:', error);
    return respErr(error instanceof Error ? error.message : 'Diagram generation failed');
  }
}

export const Route = createFileRoute('/api/chip-compare/diagram')({
  server: { handlers: { POST } },
});
