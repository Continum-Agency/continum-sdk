import type { IProviderDriver, CallOptions, ChatResult } from '../types';

export class OpenAIDriver implements IProviderDriver {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(model: string, params: CallOptions): Promise<ChatResult> {
    const isThinkingModel = model.includes('o1') || model.includes('o3') || model === 'gpt-5';

    const messages = params.systemPrompt
      ? [{ role: 'system', content: params.systemPrompt }, ...params.messages]
      : params.messages;

    const body: Record<string, any> = {
      model,
      messages,
      max_completion_tokens: params.maxTokens ?? 4096,
    };

    // Thinking models use reasoning_effort
    if (isThinkingModel) {
      body.reasoning_effort = params.reasoning_effort ?? 'medium';
    } else {
      body.temperature = params.temperature ?? 0.7;
    }
    
    // Pass through all additional parameters (tools, response_format, etc.)
    if (params.stream !== undefined) body.stream = params.stream;
    if (params.tools) body.tools = params.tools;
    if (params.tool_choice) body.tool_choice = params.tool_choice;
    if (params.response_format) body.response_format = params.response_format;
    if (params.top_p !== undefined) body.top_p = params.top_p;
    if (params.frequency_penalty !== undefined) body.frequency_penalty = params.frequency_penalty;
    if (params.presence_penalty !== undefined) body.presence_penalty = params.presence_penalty;
    if (params.stop) body.stop = params.stop;

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

    // Extract thinking block if present (o1/o3/gpt-5 reasoning)
    let thinkingBlock: string | undefined;
    if (choice?.message?.reasoning) {
      thinkingBlock = choice.message.reasoning;
    }
    
    // Extract tool calls if present
    const toolCalls = choice?.message?.tool_calls;

    return {
      content,
      model,
      provider: 'openai',
      promptTokens:  data.usage?.prompt_tokens    ?? 0,
      outputTokens:  data.usage?.completion_tokens ?? 0,
      thinkingBlock,
      finishReason: choice?.finish_reason,
      toolCalls,
      raw: data,
    };
  }
}
