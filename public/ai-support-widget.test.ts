import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AI Support widget SDK contract', () => {
  it('exposes the documented SiteGPT control methods', async () => {
    const source = await readFile(path.resolve('public/ai-support-widget.js'), 'utf8');

    expect(source).toContain('window.$sitegpt');
    expect(source).toContain('open: function');
    expect(source).toContain('close: function');
    expect(source).toContain('sendMessage: function');
    expect(source).toContain('identifyUser: function');
    expect(source).toContain('setMetadata: function');
  });

  it('polls approved human support replies for the active conversation', async () => {
    const source = await readFile(path.resolve('public/ai-support-widget.js'), 'utf8');

    expect(source).toContain('/support-replies');
    expect(source).toContain('pollSupportReplies');
  });
});
