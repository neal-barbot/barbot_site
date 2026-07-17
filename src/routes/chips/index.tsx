import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/data-table';
import { cn } from '@/lib/utils';
import { apiGet, type PageResult } from '@/lib/api-client';

interface ChipRow {
  id: string;
  manufacturer: string | null;
  partNumber: string;
  description: string | null;
  sheetUrl: string | null;
}

const PAGE_SIZE = 10;

function ChipsSearchPage() {
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'fuzzy' | 'exact'>('fuzzy');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [mode, debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ['chips', page, mode, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        mode,
        keyword: debouncedSearch,
      });
      return apiGet<PageResult<ChipRow>>(`/api/chips?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const columns: Column<ChipRow>[] = [
    {
      header: m['chips.search.col_part_number'](),
      cell: (c) => (
        <Link href={`/chips/${c.id}`} className="font-medium text-primary hover:underline">
          {c.partNumber}
        </Link>
      ),
    },
    { header: m['chips.search.col_manufacturer'](), cell: (c) => c.manufacturer || '—' },
    {
      header: m['chips.search.col_description'](),
      cell: (c) => <span className="text-muted-foreground line-clamp-2">{c.description || '—'}</span>,
    },
    {
      header: '',
      className: 'w-[90px]',
      cell: (c) => (
        <Link href={`/chips/${c.id}`}>
          <Button variant="outline" size="sm">
            {m['chips.search.view_detail']()}
          </Button>
        </Link>
      ),
    },
  ];

  const modeToggle = (
    <div className="flex rounded-lg border border-border p-0.5">
      {(['fuzzy', 'exact'] as const).map((v) => (
        <button
          key={v}
          onClick={() => setMode(v)}
          className={cn(
            'rounded-md px-3 py-1 text-sm transition-colors',
            mode === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v === 'fuzzy' ? m['chips.search.mode_fuzzy']() : m['chips.search.mode_exact']()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">{m['chips.search.title']()}</h1>
            <p className="mt-1 text-muted-foreground">{m['chips.search.subtitle']()}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m['chips.search.compare_hint']()}</p>
          </div>
          <Card>
            <CardContent>
              <DataTable
                columns={columns}
                data={listQuery.data?.items ?? []}
                total={listQuery.data?.total ?? 0}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                rowKey={(c) => c.id}
                emptyText={m['chips.search.no_data']()}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={m['chips.search.placeholder']()}
                toolbar={modeToggle}
                onRefresh={() => listQuery.refetch()}
                loading={listQuery.isFetching}
              />
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/chips/')({
  component: ChipsSearchPage,
});
