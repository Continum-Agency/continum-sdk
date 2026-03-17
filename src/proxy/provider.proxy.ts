import type { IProviderDriver, CallOptions, ChatResult, Provider } from '../types';
import { MirrorClient } from '../mirror/mirror.client';
import { GuardianClient } from '../guardian/guardian.client';

/**
 * Maps snake_case model names typed by developers to the actual API model IDs.
 * Maintains Next.js-like developer experience - built on LLM APIs like Next.js on React
 *
 * Pattern: underscores become hyphens for most providers.
 * Special cases are handled here explicitly.
 *
 * Examples:
 *   gpt_5_4_thinking   → gpt-5.4-thinking
 *   gpt_4o             → gpt-4o
 *   opus_4_6           → claude-opus-4-6
 *   haiku_4_5          → claude-haiku-4-5-20251001
 *   sonnet_4_6         → claude-sonnet-4-6
 *   gemini_2_5_pro     → gemini-2.5-pro
 */
function resolveModelId(provider: Provider, snakeKey: string): string {
  const hyphenated = snakeKey.replace(/_/g, '-');

  // Anthropic models need the claude- prefix and may need version suffixes
  if (provider === 'anthropic') {
    const anthropicMap: Record<string, string> = {
      'opus-4-6':          'claude-opus-4-6',
      'sonnet-4-6':        'claude-sonnet-4-6',
      'haiku-4-5':         'claude-haiku-4-5-20251001',
      'opus-4':            'claude-opus-4-5',
      'sonnet-4':          'claude-sonnet-4-5',
      'haiku-3-5':         'claude-haiku-3-5-20241022',
      'sonnet-3-7':        'claude-sonnet-3-7-20250219',
    };
    return anthropicMap[hyphenated] ?? `claude-${hyphenated}`;
  }

  // Gemini models: dots instead of hyphens for version numbers
  if (provider === 'gemini') {
    const geminiMap: Record<string, string> = {
      'gemini-2-5-pro':    'gemini-2.5-pro',
      'gemini-2-5-flash':  'gemini-2.5-flash',
      'gemini-2-0-flash':  'gemini-2.0-flash',
      'gemini-1-5-pro':    'gemini-1.5-pro',
    };
    return geminiMap[hyphenated] ?? hyphenated;
  }

  // OpenAI: dots for version numbers
  if (provider === 'openai') {
    const openaiMap: Record<string, string> = {
      'gpt-5-4-thinking':  'gpt-5.4-thinking',
      'gpt-5-3-codex':     'gpt-5.3-codex',
      'gpt-5':             'gpt-5',
      'gpt-4o':            'gpt-4o',
      'gpt-4-turbo':       'gpt-4-turbo',
      'o3':                'o3',
      'o3-mini':           'o3-mini',
      'o1':                'o1',
    };
    return openaiMap[hyphenated] ?? hyphenated;
  }

  return hyphenated;
}

export interface ModelProxy {
  chat(params: CallOptions): Promise<ChatResult>;
}

export class ProviderProxy {
  constructor(
    private readonly provider: Provider,
    private readonly driver:   IProviderDriver,
    private readonly mirror:   MirrorClient,
    private readonly guardian: GuardianClient,
    private readonly defaultSandbox: string,
    private readonly guardianMode: 'DETONATION' | 'GUARDIAN' | 'DUAL',
    private readonly onCall: (provider: Provider, model: string, params: CallOptions, result: ChatResult) => void,
  ) {}

  /**
   * Returns a Proxy that intercepts any property access (model name in snake_case)
   * and returns a chat() method bound to that resolved model.
   *
   * Usage:
   *   continum.llm.openai.gpt_5_4_thinking.chat({ messages: [...] })
   *   continum.llm.claude.opus_4_6.chat({ messages: [...] })
   *   continum.llm.gemini.gemini_2_5_pro.chat({ messages: [...] })
   */
  build(): Record<string, ModelProxy> {
    return new Proxy({} as Record<string, ModelProxy>, {
      get: (_target, property: string): ModelProxy => {
        const modelId = resolveModelId(this.provider, property);
        const driver  = this.driver;
        const mirror  = this.mirror;
        const defaultSandbox = this.defaultSandbox;
        const provider = this.provider;
        const onCall = this.onCall;

        return {
          chat: async (params: CallOptions): Promise<ChatResult> => {
            const sandbox = params.sandbox ?? defaultSandbox;
            
            // DUAL-MODE ARCHITECTURE:
            // 1. DETONATION: Shadow audit (0ms latency) - for testing/monitoring
            // 2. GUARDIAN: Pre-LLM protection - blocks PII before LLM sees it
            // 3. DUAL: Both modes active
            
            if (this.guardianMode === 'GUARDIAN' || this.guardianMode === 'DUAL') {
              // PRE-LLM GUARDIAN: Fast sync audit to protect against PII
              const userInput = [...params.messages]
                .reverse()
                .find(m => m.role === 'user')?.content ?? '';
              
              const systemPrompt = params.systemPrompt ?? 
                params.messages.find(m => m.role === 'system')?.content ?? '';
              
              // Fast PII detection (< 100ms) - local regex + ML model
              const guardianResult = await this.guardian.scanPrompt({
                userInput,
                systemPrompt,
                provider,
                model: modelId,
                sandbox
              });
              
              // Block or redact if violations found
              if (guardianResult.action === 'BLOCK') {
                throw new Error(`Request blocked: ${guardianResult.reasoning}`);
              }
              
              // Use redacted prompt if needed
              if (guardianResult.action === 'REDACT') {
                params = {
                  ...params,
                  messages: params.messages.map(msg => 
                    msg.role === 'user' 
                      ? { ...msg, content: guardianResult.cleanPrompt }
                      : msg
                  )
                };
              }
            }
            
            // Phase 1: Make the actual LLM call with (possibly cleaned) prompt
            const result = await driver.call(modelId, params);
            
            // Phase 2: DETONATION SANDBOX - Shadow audit (0ms latency impact)
            if (this.guardianMode === 'DETONATION' || this.guardianMode === 'DUAL') {
              if (sandbox) {
                mirror.fire(sandbox, params, result);
              }
            }
            
            // Phase 3: Notify SDK-level hook
            onCall(provider, modelId, params, result);
            
            return result;
          },
        };
      },
    });
  }
}
