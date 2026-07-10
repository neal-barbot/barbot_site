export interface KnowledgeReplyPolicyInput {
  title: string;
  excerpt: string;
  instructions: string;
  persona: string;
}

export function buildKnowledgeReply(input: KnowledgeReplyPolicyInput): string {
  const instructions = input.instructions.toLowerCase();
  const persona = input.persona.toLowerCase();
  if (!input.title || !input.excerpt.trim()) {
    return instructions.includes('human support') || instructions.includes('contact') ||
      input.instructions.includes('人工') || input.instructions.includes('联系')
      ? 'I do not have enough approved knowledge to answer that. Please request human support so our team can help.'
      : 'I do not have enough approved knowledge to answer that yet.';
  }

  const concise = persona.includes('concise');
  const formal = persona.includes('formal') || persona.includes('professional');
  const limit = concise ? 360 : 700;
  const prefix = formal ? 'According to our approved knowledge' : 'Here is what I found';
  return `${prefix} in ${input.title}: ${input.excerpt.trim().slice(0, limit)}`;
}
