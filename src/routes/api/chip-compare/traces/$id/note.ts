import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { resolveUserId } from '@/modules/apikeys/auth';
import { respErr, respOk } from '@/lib/resp';
import { updateTraceNote } from '@/modules/chip-compare/service';

const bodySchema = z.object({ note: z.string().max(2000) });

async function POST({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const { note } = bodySchema.parse(await request.json());
    const updated = await updateTraceNote(params.id, userId, note);
    if (!updated) return respErr('Trace not found');
    return respOk();
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/traces/$id/note')({
  server: { handlers: { POST } },
});
