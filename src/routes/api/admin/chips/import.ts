import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { hasPermission } from '@/modules/rbac/service';
import { importChipsCsv, type ChipCsvRow } from '@/modules/chips/service';

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

/** Minimal CSV parser handling quoted fields ("" escapes) — no external dep. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, keyof ChipCsvRow> = {
  manufacturer: 'manufacturer',
  part_number: 'partNumber',
  partnumber: 'partNumber',
  description: 'description',
  sheet_url: 'sheetUrl',
  sheeturl: 'sheetUrl',
  datasheet: 'sheetUrl',
  parameter: 'parameter',
  parameters: 'parameter',
};

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const isAdmin = await hasPermission(session.user.id, 'admin.*');
    if (!isAdmin) return respErr('Forbidden');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return respErr('No file provided');
    if (file.size > MAX_CSV_BYTES) return respErr('CSV exceeds the 5MB limit');

    const rows = parseCsv(await file.text());
    if (rows.length < 2) return respErr('CSV needs a header row and at least one data row');
    if (rows.length - 1 > MAX_ROWS) return respErr(`At most ${MAX_ROWS} rows per import`);

    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const columns = header.map((h) => HEADER_ALIASES[h]);
    if (!columns.includes('partNumber')) {
      return respErr('CSV must have a part_number column');
    }

    const chipRows: ChipCsvRow[] = rows.slice(1).map((row) => {
      const record: Partial<ChipCsvRow> = {};
      for (const [i, key] of columns.entries()) {
        if (key && row[i] !== undefined) record[key] = row[i];
      }
      return record as ChipCsvRow;
    });

    const result = await importChipsCsv(chipRows);
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Import failed');
  }
}

export const Route = createFileRoute('/api/admin/chips/import')({
  server: { handlers: { POST } },
});
