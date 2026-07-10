import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [first, second] = address.split('.').map(Number);
    return first === 10 || first === 127 || first === 0 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

export async function assertPublicKnowledgeUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http and https URLs are supported');
  if (url.username || url.password || url.port) throw new Error('Credentialed or custom-port URLs are not allowed');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) throw new Error('Local URLs are not allowed');
  const records = await lookup(host, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error('Private network URLs are not allowed');
  }
  return url;
}
