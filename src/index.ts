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
 * - Look: llm.openai.gpt_5.chat() or llm.claude.opus_4_6.chat()
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
 * UNIFIED MODE:
 * - Guardian (Pre-LLM): Blocks/redacts PII before LLM sees it
 * - Direct Execution: Full LLM call with all features (vision, streaming, tools)
 * - Detonation (Post-LLM): Shadow audit in background
 * - All three happen automatically in one seamless flow
 * 
 * Usage:
 *   const continum = new Continum({
 *     continumKey: process.env.CONTINUM_KEY,
 *     apiKeys: {
 *       openai: process.env.OPENAI_API_KEY,      // Optional: only if using OpenAI
 *       anthropic: process.env.ANTHROPIC_API_KEY, // Optional: only if using Anthropic
 *       gemini: process.env.GEMINI_API_KEY        // Optional: only if using Gemini
 *     }
 *   });
 * 
 *   // Full LLM features supported:
 *   const response = await continum.llm.openai.gpt_5.chat({
 *     messages: [
 *       { 
 *         role: 'user', 
 *         content: [
 *           { type: 'text', text: 'What is in this image?' },
 *           { type: 'image_url', image_url: 'https://...' }
 *         ]
 *       }
 *     ],
 *     reasoning_effort: 'high',  // For thinking models
 *     tools: [...],              // Function calling
 *     stream: true               // Streaming responses
 *   });
 *   // ✅ Guardian checks for PII
 *   // ✅ Full LLM call with all features
 *   // ✅ Detonation audits in background
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
    
    // Hardcoded endpoint - no longer configurable
    const endpoint = DEFAULT_ENDPOINT;
    
    this.mirror = new MirrorClient(endpoint, config.continumKey);
    this.guardian = new GuardianClient(endpoint, config.continumKey);

    const defaultSandbox = config.defaultSandbox ?? '';
    
    // Resolve API keys from unified or legacy format
    const openaiKey = config.apiKeys?.openai ?? config.openaiKey ?? '';
    const anthropicKey = config.apiKeys?.anthropic ?? config.anthropicKey ?? '';
    const geminiKey = config.apiKeys?.gemini ?? config.geminiKey ?? '';

    // Build proxies only for providers with API keys
    const llm: any = {};
    
    if (openaiKey) {
      llm.openai = this.buildProxy('openai', new OpenAIDriver(openaiKey), defaultSandbox);
    }
    
    if (anthropicKey) {
      llm.claude = this.buildProxy('anthropic', new AnthropicDriver(anthropicKey), defaultSandbox);
      llm.anthropic = llm.claude; // Alias
    }
    
    if (geminiKey) {
      llm.gemini = this.buildProxy('gemini', new GeminiDriver(geminiKey), defaultSandbox);
    }
    
    this.llm = llm;
  }

  private buildProxy(
    provider: Provider,
    driver: any,
    defaultSandbox: string
  ) {
    return new ProviderProxy(
      provider,
      driver,
      this.mirror,
      this.guardian,
      defaultSandbox,
      this.config,
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
