import type { ContinumConfig, ChatResult, CallOptions, Provider } from './types';
import { OpenAIDriver }    from './drivers/openai.driver';
import { AnthropicDriver } from './drivers/anthropic.driver';
import { GeminiDriver }    from './drivers/gemini.driver';
import { MirrorClient }    from './mirror/mirror.client';
import { ProviderProxy }   from './proxy/provider.proxy';

const DEFAULT_ENDPOINT = 'https://api.continum.io';

/**
 * Continum SDK
 *
 * The single entry point for all LLM access with built-in compliance auditing.
 * Developers replace their existing provider SDKs with this one import.
 *
 * Every call:
 *   1. Executes the LLM request directly on the developer's server (API keys stay local)
 *   2. Returns the response to the developer instantly
 *   3. Fires the compliance triplet to the Continum sandbox asynchronously
 *
 * Usage:
 *   const continum = new Continum({
 *     continumKey: process.env.CONTINUM_KEY,
 *     openaiKey:   process.env.OPENAI_API_KEY,
 *     anthropicKey:process.env.ANTHROPIC_API_KEY,
 *     defaultSandbox: 'pii_strict',
 *   });
 *
 *   // Snake case model access — IDE autocomplete works on any property
 *   const response = await continum.llm.openai.gpt_5_4_thinking.chat({
 *     messages: [{ role: 'user', content: 'Hello' }]
 *   });
 *
 *   const fast = await continum.llm.claude.haiku_4_5.chat({
 *     messages: [...],
 *     sandbox: 'bias_detection',   // override default sandbox per call
 *   });
 */
export class Continum {
  public readonly llm: {
    openai:    Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
    claude:    Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
    gemini:    Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
    anthropic: Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
  };

  private readonly mirror: MirrorClient;
  private readonly config: ContinumConfig;

  constructor(config: ContinumConfig) {
    this.config = config;
    this.mirror = new MirrorClient(
      config.apiEndpoint ?? DEFAULT_ENDPOINT,
      config.continumKey,
    );

    const defaultSandbox = config.defaultSandbox ?? '';

    this.llm = {
      openai: this.buildProxy('openai', new OpenAIDriver(config.openaiKey ?? ''), defaultSandbox),
      // claude and anthropic are aliases — both access Anthropic's API
      claude:    this.buildProxy('anthropic', new AnthropicDriver(config.anthropicKey ?? ''), defaultSandbox),
      anthropic: this.buildProxy('anthropic', new AnthropicDriver(config.anthropicKey ?? ''), defaultSandbox),
      gemini:    this.buildProxy('gemini', new GeminiDriver(config.geminiKey ?? ''), defaultSandbox),
    };
  }

  private buildProxy(
    provider: Provider,
    driver: any,
    defaultSandbox: string,
  ) {
    return new ProviderProxy(
      provider,
      driver,
      this.mirror,
      defaultSandbox,
      this.onCall.bind(this),
    ).build();
  }

  private onCall(provider: Provider, model: string, _params: CallOptions, result: ChatResult): void {
    if (process.env.CONTINUM_DEBUG === 'true') {
      console.log(`[Continum] ${provider}/${model} — ${result.promptTokens}in / ${result.outputTokens}out`);
    }
  }

  /**
   * Manually fire an audit triplet to a sandbox.
   * Useful when you've already called an LLM outside the SDK
   * and want to audit the interaction retroactively.
   */
  audit(
    sandbox: string,
    triplet: {
      provider:     string;
      model:        string;
      systemPrompt: string;
      userInput:    string;
      modelOutput:  string;
      thinkingBlock?: string;
      promptTokens?: number;
      outputTokens?: number;
    },
  ): void {
    this.mirror.fire(
      sandbox,
      { messages: [], systemPrompt: triplet.systemPrompt },
      {
        content:       triplet.modelOutput,
        model:         triplet.model,
        provider:      triplet.provider as Provider,
        promptTokens:  triplet.promptTokens ?? 0,
        outputTokens:  triplet.outputTokens ?? 0,
        thinkingBlock: triplet.thinkingBlock,
        raw: null,
      },
    );
  }
}

// Re-export types for consumers
export * from './types';
