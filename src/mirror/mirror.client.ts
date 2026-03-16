import type { ChatResult, CallOptions } from '../types';

export interface MirrorPayload {
  sandboxSlug:    string;
  provider:       string;
  model:          string;
  systemPrompt:   string;
  userInput:      string;
  modelOutput:    string;
  thinkingBlock?: string;
  promptTokens?:  number;
  outputTokens?:  number;
}

export class MirrorClient {
  private endpoint: string;
  private continumKey: string;

  constructor(endpoint: string, continumKey: string) {
    this.endpoint   = endpoint.replace(/\/$/, '');
    this.continumKey = continumKey;
  }

  /**
   * Fires the compliance triplet to the Continum backend asynchronously.
   * Never awaited in the hot path — the developer's response is never delayed.
   *
   * Extracts the system prompt from the messages array if present.
   */
  fire(
    sandboxSlug: string,
    params: CallOptions,
    result: ChatResult,
  ): void {
    const systemPrompt = params.systemPrompt
      ?? params.messages.find(m => m.role === 'system')?.content
      ?? '';

    const userInput = [...params.messages]
      .reverse()
      .find(m => m.role === 'user')?.content ?? '';

    const payload: MirrorPayload = {
      sandboxSlug,
      provider:      result.provider,
      model:         result.model,
      systemPrompt,
      userInput,
      modelOutput:   result.content,
      thinkingBlock: result.thinkingBlock,
      promptTokens:  result.promptTokens,
      outputTokens:  result.outputTokens,
    };

    // Intentionally not awaited — fire and forget
    fetch(`${this.endpoint}/audit/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-continum-key': this.continumKey,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Continum failure must NEVER affect the developer's application
    });
  }
}
