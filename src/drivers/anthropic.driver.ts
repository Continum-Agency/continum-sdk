import type { IProviderDriver, CallOptions, ChatResult } from '../types';

export class AnthropicDriver implements IProviderDriver {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(model: string, params: CallOptions): Promise<ChatResult> {
    // Claude 3.7 Sonnet and Claude 3 Opus are the primary thinking-capable models
    const isThinkingModel = 
      model.includes('claude-3-7') || 
      model.includes('sonnet-3-7') || 
      model.includes('opus');

    // 1. MINIMUM REQUIREMENT: budget_tokens must be at least 1024
    const thinkingBudget = isThinkingModel ? 1024 : 0;
    
    // 2. TOTAL TOKENS: must be strictly greater than thinkingBudget
    // We'll set a default of 4096, but ensure it's at least budget + 1024
    let maxTokens = params.maxTokens ?? 4096;
    if (isThinkingModel && maxTokens <= thinkingBudget) {
      maxTokens = thinkingBudget + 2048; 
    }

    const body: Record<string, any> = {
      model,
      max_tokens: maxTokens,
      messages: params.messages.map(m => ({ role: m.role, content: m.content })),
    };

    if (params.systemPrompt) {
      body.system = params.systemPrompt;
    }

    // Handle Extended Thinking logic
    if (isThinkingModel) {
      body.thinking = { 
        type: 'enabled', 
        budget_tokens: thinkingBudget 
      };
    } else {
      body.temperature = params.temperature ?? 0.7;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        // Required for Claude 3.7 Sonnet extended thinking features
        'anthropic-beta': 'output-128k-2025-02-19',
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
      promptTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      thinkingBlock,
      raw: data,
    };
  }
}