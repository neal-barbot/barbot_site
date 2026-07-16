import { useCallback, useRef, useState } from 'react';

export interface CompareStreamState {
  status: 'idle' | 'running' | 'done' | 'error';
  stage: string;
  report: string;
  recordId: string | null;
  cacheHit: boolean;
  error: string | null;
}

export interface CompareRunInput {
  parts: string[];
  files: Array<{ fileMd5: string; fileName: string; partNumber?: string }>;
  language: string;
  userPrompt?: string;
}

const initialState: CompareStreamState = {
  status: 'idle',
  stage: '',
  report: '',
  recordId: null,
  cacheHit: false,
  error: null,
};

/**
 * Runs the compare pipeline over the SSE endpoint. EventSource cannot POST,
 * so this reads the fetch body stream and parses SSE frames manually — the
 * one sanctioned raw-fetch exception (api-client has no streaming support).
 */
export function useCompareStream() {
  const [state, setState] = useState<CompareStreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const run = useCallback(async (input: CompareRunInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...initialState, status: 'running' });

    const handleFrame = (frame: string) => {
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;

      let payload: { content?: string; recordId?: string } = {};
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }

      setState((prev) => {
        switch (event) {
          case 'stage':
            return { ...prev, stage: payload.content ?? '', recordId: payload.recordId ?? prev.recordId };
          case 'token':
            return { ...prev, report: prev.report + (payload.content ?? ''), recordId: payload.recordId ?? prev.recordId };
          case 'message':
            // full cached report in one frame
            return { ...prev, report: payload.content ?? '', cacheHit: true, recordId: payload.recordId ?? prev.recordId };
          case 'done':
            return { ...prev, status: 'done', stage: '', recordId: payload.recordId ?? prev.recordId };
          case 'error':
            return { ...prev, status: 'error', error: payload.content ?? 'Failed', recordId: payload.recordId ?? prev.recordId };
          default:
            return prev;
        }
      });
    };

    try {
      const response = await fetch('/api/chip-compare/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        // Pre-stream failure (auth, rate limit) arrives as a JSON envelope.
        const json = await response.json().catch(() => null);
        throw new Error(json?.message || `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error('No response stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          handleFrame(buffer.slice(0, sep));
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf('\n\n');
        }
      }
      if (buffer.trim()) handleFrame(buffer);

      // Stream closed without done/error → treat as error unless already terminal.
      setState((prev) =>
        prev.status === 'running'
          ? { ...prev, status: prev.report ? 'done' : 'error', error: prev.report ? null : 'Stream ended unexpectedly' }
          : prev
      );
    } catch (error) {
      if (controller.signal.aborted) {
        setState((prev) => ({ ...prev, status: 'idle', stage: '' }));
        return;
      }
      const message = error instanceof Error ? error.message : 'Request failed';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState);
  }, []);

  return { state, run, cancel, reset };
}
