import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, GitCompareArrows } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';

interface ChipDetail {
  chip: {
    id: string;
    manufacturer: string | null;
    partNumber: string;
    description: string | null;
    sheetUrl: string | null;
    parameter: string | null;
  };
  segment: { id: string; name: string } | null;
  substitutes: Array<{
    id: string;
    supplier: string | null;
    partNumber: string;
    supplierP2p: string | null;
    partNumberP2p: string;
  }>;
  bomItems: Array<{
    id: string;
    categoryName: string | null;
    partNumber: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

function parseParameters(raw: string | null): Array<[string, string]> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed).map(([k, v]) => [
        k,
        typeof v === 'object' ? JSON.stringify(v) : String(v),
      ]);
    }
  } catch {
    // fall through
  }
  return [];
}

function ChipDetailPage() {
  const { id } = Route.useParams();

  const detailQuery = useQuery({
    queryKey: ['chip-detail', id],
    queryFn: () => apiGet<ChipDetail>(`/api/chips/${id}`),
  });

  const detail = detailQuery.data;
  const params = parseParameters(detail?.chip.parameter ?? null);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
          <Link
            href="/chips"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {m['chips.detail.back']()}
          </Link>

          {detailQuery.isLoading ? (
            <div className="py-20 text-center text-muted-foreground">…</div>
          ) : !detail ? (
            <div className="py-20 text-center text-muted-foreground">
              {m['chips.detail.not_found']()}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-mono text-3xl font-bold tracking-tight">
                    {detail.chip.partNumber}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {detail.chip.manufacturer && (
                      <span>
                        {m['chips.detail.manufacturer']()}: {detail.chip.manufacturer}
                      </span>
                    )}
                    {detail.segment && (
                      <Badge variant="secondary">{detail.segment.name}</Badge>
                    )}
                  </div>
                  {detail.chip.description && (
                    <p className="mt-3 max-w-2xl text-muted-foreground">
                      {detail.chip.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {detail.chip.sheetUrl && (
                    <a href={detail.chip.sheetUrl} target="_blank" rel="noopener nofollow">
                      <Button variant="outline">
                        <ExternalLink className="size-4" />
                        {m['chips.detail.datasheet']()}
                      </Button>
                    </a>
                  )}
                  <Link href={`/compare?part=${encodeURIComponent(detail.chip.partNumber)}`}>
                    <Button>
                      <GitCompareArrows className="size-4" />
                      {m['chips.detail.compare_cta']()}
                    </Button>
                  </Link>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{m['chips.detail.parameters']()}</CardTitle>
                </CardHeader>
                <CardContent>
                  {params.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {m['chips.detail.no_parameters']()}
                    </p>
                  ) : (
                    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      {params.map(([key, value]) => (
                        <div key={key} className="border-b border-border/50 pb-2">
                          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                            {key}
                          </dt>
                          <dd className="mt-0.5 font-mono text-sm">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{m['chips.detail.substitutes']()}</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.substitutes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {m['chips.detail.no_substitutes']()}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">{m['chips.detail.sub_col_supplier']()}</th>
                            <th className="py-2 pr-4 font-medium">{m['chips.detail.sub_col_part']()}</th>
                            <th className="py-2 pr-4 font-medium">{m['chips.detail.sub_col_supplier_p2p']()}</th>
                            <th className="py-2 font-medium">{m['chips.detail.sub_col_part_p2p']()}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.substitutes.map((s) => (
                            <tr key={s.id} className="border-b border-border/50">
                              <td className="py-2 pr-4">{s.supplier || '—'}</td>
                              <td className="py-2 pr-4 font-mono">{s.partNumber}</td>
                              <td className="py-2 pr-4">{s.supplierP2p || '—'}</td>
                              <td className="py-2 font-mono">{s.partNumberP2p}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{m['chips.detail.bom']()}</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.bomItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{m['chips.detail.no_bom']()}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">{m['chips.detail.bom_col_category']()}</th>
                            <th className="py-2 pr-4 font-medium">{m['chips.detail.bom_col_part']()}</th>
                            <th className="py-2 pr-4 font-medium">{m['chips.detail.bom_col_qty']()}</th>
                            <th className="py-2 pr-4 font-medium">{m['chips.detail.bom_col_unit_price']()}</th>
                            <th className="py-2 font-medium">{m['chips.detail.bom_col_total']()}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.bomItems.map((b) => (
                            <tr key={b.id} className="border-b border-border/50">
                              <td className="py-2 pr-4">{b.categoryName || '—'}</td>
                              <td className="py-2 pr-4 font-mono">{b.partNumber}</td>
                              <td className="py-2 pr-4">{b.quantity}</td>
                              <td className="py-2 pr-4">{(b.unitPrice / 100).toFixed(2)}</td>
                              <td className="py-2">{(b.totalPrice / 100).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/chips/$id')({
  component: ChipDetailPage,
});
