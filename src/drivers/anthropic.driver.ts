import type { IProviderDriver, CallOptions, ChatResult } from '../types';

export class AnthropicDriver implements IProviderDriver {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(model: string, params: CallOptions): Promise<ChatResult> {
    const isThinkingModel =
      model.includes('opus') || model.includes('sonnet-4') || model.includes('claude-4');

    const body: Record<string, any> = {
      model,
      max_tokens: params.maxTokens ?? 4096,
      messages: params.messages.map(m => ({ role: m.role, content: m.content })),
    };

    if (params.systemPrompt) {
      body.system = params.systemPrompt;
    }

    // Enable extended thinking for capable models
    if (isThinkingModel) {
      body.thinking = { type: 'enabled', budget_tokens: 8000 };
    } else {
      body.temperature = params.temperature ?? 0.7;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Anthropic error ${response.status}: ${JSON.stringify(err)}`);
    }

    const data = await response.json() as any;

    // Extract text and thinking blocks from content array
    let content = '';
    let thinkingBlock: string | undefined;

    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'thinking') {
        thinkingBlock = block.thinking;
      }
    }

    return {
      content,
      model,
      provider: 'anthropic',
      promptTokens:  data.usage?.input_tokens  ?? 0,
      outputTokens:  data.usage?.output_tokens ?? 0,
      thinkingBlock,
      raw: data,
    };
  }
}
