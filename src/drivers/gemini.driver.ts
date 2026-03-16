import type { IProviderDriver, CallOptions, ChatResult } from '../types';

export class GeminiDriver implements IProviderDriver {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(model: string, params: CallOptions): Promise<ChatResult> {
    const contents = params.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = params.systemPrompt
      ? { parts: [{ text: params.systemPrompt }] }
      : undefined;

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        maxOutputTokens: params.maxTokens ?? 4096,
        temperature:     params.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini error ${response.status}: ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return {
      content,
      model,
      provider: 'gemini',
      promptTokens:  data.usageMetadata?.promptTokenCount    ?? 0,
      outputTokens:  data.usageMetadata?.candidatesTokenCount ?? 0,
      raw: data,
    };
  }
}
