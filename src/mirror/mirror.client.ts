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
    const systemMessage = params.messages.find(m => m.role === 'system');
    const systemPrompt = params.systemPrompt
      ?? (typeof systemMessage?.content === 'string' ? systemMessage.content : '')
      ?? '';

    const userMessage = [...params.messages]
      .reverse()
      .find(m => m.role === 'user');
    
    const userInput = typeof userMessage?.content === 'string'
      ? userMessage.content
      : JSON.stringify(userMessage?.content ?? '');

    const payload: MirrorPayload = {
      sandboxSlug,
      provider:      result.provider,
      model:         result.model,
      systemPrompt:  systemPrompt || 'No system prompt',  // Ensure non-empty
      userInput:     userInput || 'No user input',        // Ensure non-empty
      modelOutput:   result.content || 'No output',       // Ensure non-empty
      thinkingBlock: result.thinkingBlock,
      promptTokens:  result.promptTokens,
      outputTokens:  result.outputTokens,
    };

    // Debug logging
    if (process.env.CONTINUM_DEBUG === 'true') {
      console.log('[Continum Mirror] Sending audit to:', `${this.endpoint}/audit/ingest`);
      console.log('[Continum Mirror] Sandbox:', sandboxSlug);
      console.log('[Continum Mirror] Provider:', result.provider);
      console.log('[Continum Mirror] Model:', result.model);
      console.log('[Continum Mirror] Payload:', JSON.stringify(payload, null, 2));
    }

    // Intentionally not awaited — fire and forget
    fetch(`${this.endpoint}/audit/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-continum-key': this.continumKey,
      },
      body: JSON.stringify(payload),
    })
    .then(async response => {
      if (process.env.CONTINUM_DEBUG === 'true') {
        console.log('[Continum Mirror] Response status:', response.status);
      }
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error');
        console.warn('[Continum Mirror] Audit failed:', response.status, response.statusText);
        console.warn('[Continum Mirror] Error details:', errorBody);
      }
    })
    .catch((error) => {
      if (process.env.CONTINUM_DEBUG === 'true') {
        console.warn('[Continum Mirror] Audit error:', error.message);
      }
      // Continum failure must NEVER affect the developer's application
    });
  }
}
