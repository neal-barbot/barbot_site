import { describe, expect, it } from 'vitest';
import { assertPublicKnowledgeUrl } from './url-security';

describe('knowledge providers', () => {
  it('rejects local and credentialed URLs before any provider request', async () => {
    await expect(assertPublicKnowledgeUrl('http://localhost/help')).rejects.toThrow('Local URLs are not allowed');
    await expect(assertPublicKnowledgeUrl('https://user:pass@example.com/help')).rejects.toThrow('Credentialed');
  });

  it('allows public HTTPS URLs after DNS validation', async () => {
    await expect(assertPublicKnowledgeUrl('https://example.com/help')).resolves.toBeInstanceOf(URL);
  });
});
