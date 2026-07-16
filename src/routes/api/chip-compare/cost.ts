import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { getCompareCost } from '@/modules/chip-compare/service';

async function GET() {
  try {
    return respData({ costCredits: await getCompareCost() });
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/cost')({
  server: { handlers: { GET } },
});
