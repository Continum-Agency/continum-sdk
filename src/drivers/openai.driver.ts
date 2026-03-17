import type { IProviderDriver, CallOptions, ChatResult } from '../types';

export class OpenAIDriver implements IProviderDriver {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(model: string, params: CallOptions): Promise<ChatResult> {
    const isThinkingModel = model.includes('thinking') || model.includes('o1') || model.includes('o3');

    const messages = params.systemPrompt
      ? [{ role: 'system', content: params.systemPrompt }, ...params.messages]
      : params.messages;

    const body: Record<string, any> = {
      model,
      messages,
      max_completion_tokens: params.maxTokens ?? 4096,
    };

    // Thinking models use specific parameters
    if (isThinkingModel) {
      body.reasoning_effort = 'medium';
    } else {
      body.temperature = params.temperature ?? 0.7;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI error ${response.status}: ${JSON.stringify(err)}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? '';

    // Extract thinking block if present (o1/o3/thinking models)
    let thinkingBlock: string | undefined;
    if (choice?.message?.reasoning) {
      thinkingBlock = choice.message.reasoning;
    }

    return {
      content,
      model,
      provider: 'openai',
      promptTokens:  data.usage?.prompt_tokens    ?? 0,
      outputTokens:  data.usage?.completion_tokens ?? 0,
      thinkingBlock,
      raw: data,
    };
  }
}
