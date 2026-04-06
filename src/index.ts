import type { ContinumConfig, ChatResult, CallOptions, Provider } from './types';
import { OpenAIDriver }    from './drivers/openai.driver';
import { AnthropicDriver } from './drivers/anthropic.driver';
import { GeminiDriver }    from './drivers/gemini.driver';
import { MirrorClient }    from './mirror/mirror.client';
import { GuardianClient }  from './guardian/guardian.client';
import { SandboxConfigClient } from './sandbox/sandbox.client';
import { ProviderProxy }   from './proxy/provider.proxy';

const DEFAULT_ENDPOINT = 'https://api.continum.co';

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

  public readonly sandboxes: SandboxConfigClient;

  private readonly mirror: MirrorClient;
  private readonly guardian: GuardianClient;
  private readonly config: ContinumConfig;

  constructor(config: ContinumConfig) {
    this.config = config;
    
    // Hardcoded endpoint - no longer configurable
    const endpoint = DEFAULT_ENDPOINT;
    
    this.mirror = new MirrorClient(endpoint, config.continumKey, config.organizationId);
    this.guardian = new GuardianClient(endpoint, config.continumKey);
    this.sandboxes = new SandboxConfigClient(endpoint, config.continumKey);
    
    // Resolve API keys from unified or legacy format
    const openaiKey = config.apiKeys?.openai ?? config.openaiKey ?? '';
    const anthropicKey = config.apiKeys?.anthropic ?? config.anthropicKey ?? '';
    const geminiKey = config.apiKeys?.gemini ?? config.geminiKey ?? '';

    // Build proxies only for providers with API keys
    const llm: any = {};
    
    if (openaiKey) {
      llm.openai = this.buildProxy('openai', new OpenAIDriver(openaiKey));
    }
    
    if (anthropicKey) {
      llm.claude = this.buildProxy('anthropic', new AnthropicDriver(anthropicKey));
      llm.anthropic = llm.claude; // Alias
    }
    
    if (geminiKey) {
      llm.gemini = this.buildProxy('gemini', new GeminiDriver(geminiKey));
    }
    
    this.llm = llm;
  }

  private buildProxy(
    provider: Provider,
    driver: any
  ) {
    return new ProviderProxy(
      provider,
      driver,
      this.mirror,
      this.guardian,
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
   * 
   * @param prompt - The prompt text to scan
   * @param options - Scan options including required sandbox
   */
  async scanPrompt(
    prompt: string,
    options: {
      sandbox: string;      // Required: sandbox slug to use
      provider?: string;
      model?: string;
    }
  ) {
    if (!options.sandbox) {
      throw new Error('sandbox is required for scanPrompt');
    }
    
    return this.guardian.scanPrompt({
      userInput: prompt,
      systemPrompt: '',
      provider: options.provider ?? 'openai',
      model: options.model ?? 'gpt-4o',
      sandbox: options.sandbox
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

  /**
   * Batch LLM calls - Execute multiple LLM calls in parallel
   * Useful for processing multiple prompts efficiently
   */
  async batchChat(
    calls: Array<{
      provider: 'openai' | 'anthropic' | 'gemini';
      model: string;
      params: CallOptions;
    }>
  ): Promise<ChatResult[]> {
    return Promise.all(
      calls.map(call => {
        const providerProxy = this.llm[call.provider as keyof typeof this.llm];
        if (!providerProxy) {
          throw new Error(`Provider ${call.provider} not configured. Add API key to config.`);
        }
        return providerProxy[call.model].chat(call.params);
      })
    );
  }

  /**
   * Smart LLM call with automatic retry and fallback
   * Retries on transient errors and falls back to alternative providers
   */
  async smartChat(
    provider: 'openai' | 'anthropic' | 'gemini',
    model: string,
    params: CallOptions
  ): Promise<ChatResult> {
    const retryConfig = this.config.retryConfig ?? {};
    const maxAttempts = retryConfig.maxAttempts ?? 3;
    const backoffMultiplier = retryConfig.backoffMultiplier ?? 2;
    const initialDelayMs = retryConfig.initialDelayMs ?? 1000;
    const retryEnabled = retryConfig.enabled !== false && !params.skipRetry;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const providerProxy = this.llm[provider as keyof typeof this.llm];
        if (!providerProxy) {
          throw new Error(`Provider ${provider} not configured. Add API key to config.`);
        }
        return await providerProxy[model].chat(params);
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on Guardian blocks or final attempt
        if (error.message?.includes('Guardian blocked') || attempt === maxAttempts - 1) {
          break;
        }
        
        // Don't retry if disabled
        if (!retryEnabled) {
          break;
        }
        
        // Exponential backoff
        const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        if (process.env.CONTINUM_DEBUG === 'true') {
          console.log(`[Continum] Retry attempt ${attempt + 1}/${maxAttempts} after ${delayMs}ms`);
        }
      }
    }
    
    // Try fallback providers if configured
    if (this.config.fallbackConfig?.enabled && this.config.fallbackConfig.fallbackOrder) {
      for (const fallback of this.config.fallbackConfig.fallbackOrder) {
        try {
          if (process.env.CONTINUM_DEBUG === 'true') {
            console.log(`[Continum] Falling back to ${fallback.provider}/${fallback.model}`);
          }
          
          const providerProxy = this.llm[fallback.provider as keyof typeof this.llm];
          if (!providerProxy) continue;
          
          return await providerProxy[fallback.model].chat(params);
        } catch (error) {
          // Continue to next fallback
          continue;
        }
      }
    }
    
    throw lastError ?? new Error('All attempts failed');
  }
}

// Re-export types for consumers
export * from './types';
