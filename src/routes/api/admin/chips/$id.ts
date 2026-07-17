import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr, respOk } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { hasPermission } from '@/modules/rbac/service';
import {
  addBomItem,
  addPin2Pin,
  deleteBomItem,
  deleteChip,
  deletePin2Pin,
  updateChip,
} from '@/modules/chips/service';

async function checkAdmin(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new Error('Unauthorized');
  const isAdmin = await hasPermission(session.user.id, 'admin.*');
  if (!isAdmin) throw new Error('Forbidden');
  return session;
}

const updateSchema = z.object({
  manufacturer: z.string().max(255).nullish(),
  partNumber: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullish(),
  sheetUrl: z.string().url().max(1024).nullish().or(z.literal('').transform(() => null)),
  parameter: z.string().max(100_000).nullish(),
  segmentId: z.string().max(64).nullish().or(z.literal('').transform(() => null)),
  addPin2Pin: z
    .object({
      supplier: z.string().max(255).nullish(),
      partNumber: z.string().min(1).max(255),
      supplierP2p: z.string().max(255).nullish(),
      partNumberP2p: z.string().min(1).max(255),
    })
    .optional(),
  removePin2PinId: z.string().max(64).optional(),
  addBom: z
    .object({
      manufacturer: z.string().max(255).nullish(),
      categoryName: z.string().max(255).nullish(),
      partNumber: z.string().min(1).max(255),
      quantity: z.number().int().min(1).optional(),
      unitPrice: z.number().int().min(0).optional(),
    })
    .optional(),
  removeBomId: z.string().max(64).optional(),
});

async function PUT({ request, params }: { request: Request; params: { id: string } }) {
  try {
    await checkAdmin(request);
    const input = updateSchema.parse(await request.json());

    if (input.addPin2Pin) await addPin2Pin({ chipId: params.id, ...input.addPin2Pin });
    if (input.removePin2PinId) await deletePin2Pin(input.removePin2PinId);
    if (input.addBom) await addBomItem({ chipId: params.id, ...input.addBom });
    if (input.removeBomId) await deleteBomItem(input.removeBomId);

    const { addPin2Pin: _a, removePin2PinId: _b, addBom: _c, removeBomId: _d, ...chipFields } = input;
    const updated = await updateChip(params.id, chipFields);
    if (!updated) return respErr('Chip not found');
    return respData(updated);
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  try {
    await checkAdmin(request);
    await deleteChip(params.id);
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/admin/chips/$id')({
  server: { handlers: { PUT, DELETE } },
});
