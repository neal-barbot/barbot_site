export function isAllowedWidgetRequest(request: Request, allowedDomains: string[]): boolean {
  const normalized = allowedDomains.map(normalizeDomain).filter(Boolean);
  if (normalized.length === 0) return true;

  const source = request.headers.get('origin') || request.headers.get('referer');
  if (!source) return true;

  let hostname = '';
  try {
    hostname = new URL(source).hostname.toLowerCase();
  } catch {
    return false;
  }

  return normalized.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^www\./, '');
  }
}
