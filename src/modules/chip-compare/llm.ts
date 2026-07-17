export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Stream a chat completion from an OpenAI-compatible endpoint (OpenAI, DeepSeek, …).
 * Invokes onToken per content delta; resolves with the full text and usage.
 */
export async function streamChatCompletion(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  onToken?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<StreamChatResult> {
  const { baseUrl, apiKey, model, messages, onToken, signal } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    try {
      const parsed = JSON.parse(payload);
      const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        onToken?.(delta);
      }
      if (parsed.usage) {
        inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
        outputTokens = parsed.usage.completion_tokens ?? outputTokens;
      }
    } catch {
      // Ignore malformed keep-alive/partial lines.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      handleLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
  }
  if (buffer) handleLine(buffer);

  if (!text.trim()) {
    throw new Error('LLM returned an empty response');
  }

  return { text, inputTokens, outputTokens };
}
