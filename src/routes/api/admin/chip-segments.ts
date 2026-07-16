import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr, respOk } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { hasPermission } from '@/modules/rbac/service';
import {
  createSegment,
  deleteSegment,
  listSegments,
  updateSegment,
} from '@/modules/chips/service';

async function checkAdmin(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new Error('Unauthorized');
  const isAdmin = await hasPermission(session.user.id, 'admin.*');
  if (!isAdmin) throw new Error('Forbidden');
  return session;
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullish(),
  parentId: z.string().max(64).nullish().or(z.literal('').transform(() => null)),
  sort: z.number().int().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullish(),
  sort: z.number().int().optional(),
});

async function GET({ request }: { request: Request }) {
  try {
    await checkAdmin(request);
    return respData(await listSegments());
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function POST({ request }: { request: Request }) {
  try {
    await checkAdmin(request);
    const input = createSchema.parse(await request.json());
    return respData(await createSegment(input));
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

async function PUT({ request }: { request: Request }) {
  try {
    await checkAdmin(request);
    const { id, ...input } = updateSchema.parse(await request.json());
    const updated = await updateSegment(id, input);
    if (!updated) return respErr('Segment not found');
    return respData(updated);
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

async function DELETE({ request }: { request: Request }) {
  try {
    await checkAdmin(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return respErr('id is required');
    await deleteSegment(id);
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/admin/chip-segments')({
  server: { handlers: { GET, POST, PUT, DELETE } },
});
