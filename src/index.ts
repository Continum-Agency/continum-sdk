import type { ContinumConfig, ChatResult, CallOptions, Provider } from './types';
import { OpenAIDriver }    from './drivers/openai.driver';
import { AnthropicDriver } from './drivers/anthropic.driver';
import { GeminiDriver }    from './drivers/gemini.driver';
import { MirrorClient }    from './mirror/mirror.client';
import { GuardianClient }  from './guardian/guardian.client';
import { ProviderProxy }   from './proxy/provider.proxy';

const DEFAULT_ENDPOINT = 'https://api.continum.io';

/**
 * Continum SDK — The "Next.js" to the AI world's "React"
 * 
 * GOVERNED EXECUTION FRAMEWORK:
 * Transforms raw, high-risk AI connections into structured, armored, compliant interactions.
 * 
 * THE INTERFACE: "Snake Case" Control Panel
 * - Path: llm → provider → model → action
 * - Look: llm.openai.gpt_5_4_thinking.chat() or llm.claude.haiku_4_5.chat()
 * - Feel: Premium, organized hierarchy with perfect autocomplete
 * 
 * THE RELATIONSHIP: "Shadow Bodyguard"
 * - Sovereignty-First Interceptor: Sits on YOUR server, manages AI relationships
 * - Direct Execution: Your app talks to AI directly, you keep your API keys
 * - Zero Latency: AI answers delivered instantly, no waiting for security checks
 * - Shadow Fork: While user reads answer, SDK silently audits in background
 * 
 * THE BACKEND: "Detonation Chamber"
 * - Stateless Sandbox: Every audit spawns a temporary, isolated environment
 * - Vanishing Room: Exists only in RAM, vaporized after audit
 * - The Signal: Returns simple "Safe" or "Danger" to your dashboard
 * - Total Sovereignty: Raw data never stored, only compliance signals
 * 
 * VALUE PROPOSITION:
 * | Fear           | Continum's Solution                                    |
 * |----------------|-------------------------------------------------------|
 * | Data Leaks     | Detonation Chamber: Raw data vanishes after audit    |
 * | Trust/Privacy  | Sovereignty-First: You keep API keys, we audit       |
 * | Compliance     | Framework: Automatic legal safety standards          |
 * 
 * Usage:
 *   const continum = new Continum({
 *     continumKey: process.env.CONTINUM_KEY,
 *     openaiKey:   process.env.OPENAI_API_KEY,  // Stays on YOUR server
 *     mode: 'SHADOW_BODYGUARD' // Pure shadow audit, 0ms latency
 *   });
 * 
 *   // The organized filing cabinet approach:
 *   const response = await continum.llm.openai.gpt_5_4_thinking.chat({
 *     messages: [{ role: 'user', content: 'Hello' }]
 *   });
 *   // ✅ User gets response instantly (Direct Execution)
 *   // ✅ Shadow Fork audits in Detonation Chamber
 *   // ✅ Compliance signal appears in dashboard
 */
export class Continum {
  public readonly llm: {
    openai:    Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
    claude:    Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
    gemini:    Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
    anthropic: Record<string, { chat(params: CallOptions): Promise<ChatResult> }>;
  };

  private readonly mirror: MirrorClient;
  private readonly guardian: GuardianClient;
  private readonly config: ContinumConfig;

  constructor(config: ContinumConfig) {
    this.config = config;
    this.mirror = new MirrorClient(
      config.apiEndpoint ?? DEFAULT_ENDPOINT,
      config.continumKey,
    );
    this.guardian = new GuardianClient(
      config.apiEndpoint ?? DEFAULT_ENDPOINT,
      config.continumKey,
    );

    const defaultSandbox = config.defaultSandbox ?? '';
    const mode = config.mode ?? 'SHADOW_BODYGUARD'; // Default to pure shadow audit

    this.llm = {
      openai: this.buildProxy('openai', new OpenAIDriver(config.openaiKey ?? ''), defaultSandbox, mode),
      // claude and anthropic are aliases — both access Anthropic's API
      claude:    this.buildProxy('anthropic', new AnthropicDriver(config.anthropicKey ?? ''), defaultSandbox, mode),
      anthropic: this.buildProxy('anthropic', new AnthropicDriver(config.anthropicKey ?? ''), defaultSandbox, mode),
      gemini:    this.buildProxy('gemini', new GeminiDriver(config.geminiKey ?? ''), defaultSandbox, mode),
    };
  }

  private buildProxy(
    provider: Provider,
    driver: any,
    defaultSandbox: string,
    mode: 'DETONATION' | 'GUARDIAN' | 'DUAL' | 'SHADOW_BODYGUARD'
  ) {
    // Convert legacy mode names to current architecture
    const normalizedMode: 'DETONATION' | 'GUARDIAN' | 'DUAL' = 
      mode === 'SHADOW_BODYGUARD' ? 'DETONATION' : mode;
    
    return new ProviderProxy(
      provider,
      driver,
      this.mirror,
      this.guardian,
      defaultSandbox,
      normalizedMode,
      this.onCall.bind(this),
    ).build();
  }

  private onCall(provider: Provider, model: string, _params: CallOptions, result: ChatResult): void {
    if (process.env.CONTINUM_DEBUG === 'true') {
      console.log(`[Continum] ${provider}/${model} — ${result.promptTokens}in / ${result.outputTokens}out`);
    }
  }

  /**
   * Manually scan a prompt for PII before sending to LLM
   * Useful for custom validation flows
   */
  async scanPrompt(
    prompt: string,
    options?: {
      sandbox?: string;
      provider?: string;
      model?: string;
    }
  ) {
    return this.guardian.scanPrompt({
      userInput: prompt,
      systemPrompt: '',
      provider: options?.provider ?? 'openai',
      model: options?.model ?? 'gpt-4o',
      sandbox: options?.sandbox ?? this.config.defaultSandbox ?? 'default'
    });
  }

  /**
   * Shadow Bodyguard Audit - The core of the Governed Execution Framework
   * Retroactive analysis in the Detonation Chamber (Stateless Sandbox)
   */
  shadowAudit(
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
