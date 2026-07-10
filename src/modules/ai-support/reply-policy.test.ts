import { describe, expect, it } from 'vitest';
import { buildKnowledgeReply } from './reply-policy';

describe('buildKnowledgeReply', () => {
  it('uses a concise persona to limit retrieved content', () => {
    const reply = buildKnowledgeReply({
      title: 'Refund policy',
      excerpt: 'x'.repeat(800),
      instructions: 'Answer from approved knowledge only.',
      persona: 'Helpful, concise, and careful support agent.',
    });

    expect(reply).toContain('Refund policy');
    expect(reply.length).toBeLessThan(500);
  });

  it('uses the configured fallback when there is no knowledge match', () => {
    const reply = buildKnowledgeReply({
      title: '',
      excerpt: '',
      instructions: 'Ask visitors to request human support when knowledge is missing.',
      persona: 'Professional support agent.',
    });

    expect(reply).toContain('human support');
  });
});
