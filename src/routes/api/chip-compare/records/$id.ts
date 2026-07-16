import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr, respOk } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { deleteRecord, getRecord, updateRecordResult } from '@/modules/chip-compare/service';

const patchSchema = z.object({ result: z.string().max(500_000) });

async function GET({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const record = await getRecord(params.id, session.user.id);
    if (!record) return respErr('Record not found');
    return respData(record);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const deleted = await deleteRecord(params.id, session.user.id);
    if (!deleted) return respErr('Record not found');
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { result } = patchSchema.parse(await request.json());
    const updated = await updateRecordResult(params.id, session.user.id, result);
    if (!updated) return respErr('Record not found');
    return respOk();
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/records/$id')({
  server: { handlers: { GET, DELETE, PATCH } },
});
