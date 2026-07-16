import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import {
  MAX_CHIPS,
  MIN_CHIPS,
  runComparePipeline,
  type CompareEvent,
} from '@/modules/chip-compare/service';

const bodySchema = z
  .object({
    parts: z.array(z.string().min(1).max(128)).max(MAX_CHIPS).default([]),
    files: z
      .array(
        z.object({
          fileMd5: z.string().length(32),
          fileName: z.string().min(1).max(512),
          partNumber: z.string().max(128).optional(),
        })
      )
      .max(MAX_CHIPS)
      .default([]),
    language: z.string().max(20).default('en'),
    userPrompt: z.string().max(2000).optional(),
  })
  .refine((v) => v.parts.length + v.files.length >= MIN_CHIPS, {
    message: `Select at least ${MIN_CHIPS} chips`,
  })
  .refine((v) => v.parts.length + v.files.length <= MAX_CHIPS, {
    message: `At most ${MAX_CHIPS} chips`,
  });

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 5000,
    keyPrefix: 'chip-compare-analyze',
  });
  if (limited) return limited;

  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return respErr('Unauthorized');

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || 'Invalid request');
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  request.signal?.addEventListener('abort', () => abortController.abort());

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };
      const keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          closed = true;
        }
      }, 15000);

      const finish = () => {
        clearInterval(keepalive);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };

      let errorSent = false;
      runComparePipeline({
        userId,
        parts: input.parts,
        files: input.files,
        language: input.language,
        userPrompt: input.userPrompt,
        signal: abortController.signal,
        onEvent: (event: CompareEvent) => {
          if (event.type === 'error') errorSent = true;
          send(event.type, event);
        },
      })
        .catch((error: Error) => {
          // Pipeline emits its own error event once a record exists; this covers
          // pre-record failures (config/balance/validation).
          if (!errorSent) send('error', { type: 'error', content: error.message });
        })
        .finally(finish);
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const Route = createFileRoute('/api/chip-compare/analyze')({
  server: { handlers: { POST } },
});
