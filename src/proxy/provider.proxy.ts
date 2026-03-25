import type { IProviderDriver, CallOptions, ChatResult, Provider, ContinumConfig } from '../types';
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
 *   gpt_5   → gpt-5
 *   gpt_4o  → gpt-4o
 *   o3      → o3
 *   opus_4_6   → claude-opus-4-6
 *   haiku_4_5  → claude-haiku-4-5-20251001
 *   sonnet_4_6 → claude-sonnet-4-6
 *   gemini_2_5_pro → gemini-2.5-pro
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
      'haiku-3-5':         'claude-3-5-haiku-20241022',
      'sonnet-3-7':        'claude-sonnet-3-7-20250219',
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
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
    private readonly config: ContinumConfig,
    private readonly onCall: (provider: Provider, model: string, params: CallOptions, result: ChatResult) => void,
  ) {}

  /**
   * Returns a Proxy that intercepts any property access (model name in snake_case)
   * and returns a chat() method bound to that resolved model.
   *
   * Usage:
   *   continum.llm.openai.gpt_5.chat({ messages: [...] })
   *   continum.llm.claude.opus_4_6.chat({ messages: [...] })
   *   continum.llm.gemini.gemini_2_5_pro.chat({ messages: [...] })
   */
  build(): Record<string, ModelProxy> {
    return new Proxy({} as Record<string, ModelProxy>, {
      get: (_target, property: string): ModelProxy => {
        const modelId = resolveModelId(this.provider, property);
        const driver  = this.driver;
        const mirror  = this.mirror;
        const guardian = this.guardian;
        const defaultSandbox = this.defaultSandbox;
        const provider = this.provider;
        const onCall = this.onCall;
        const config = this.config;

        return {
          chat: async (params: CallOptions): Promise<ChatResult> => {
            const sandbox = params.sandbox ?? defaultSandbox;
            
            // UNIFIED MODE: Guardian → LLM → Detonation (all automatic)
            
            // Phase 1: GUARDIAN (Pre-LLM Protection)
            const guardianEnabled = config.guardianConfig?.enabled !== false && !params.skipGuardian;
            
            if (guardianEnabled) {
              // Extract user input (handle both string and multimodal content)
              const userMessage = [...params.messages]
                .reverse()
                .find(m => m.role === 'user');
              
              const userInput = typeof userMessage?.content === 'string' 
                ? userMessage.content
                : JSON.stringify(userMessage?.content ?? '');
              
              const systemMessage = params.messages.find(m => m.role === 'system');
              const systemPrompt = params.systemPrompt ?? 
                (typeof systemMessage?.content === 'string'
                  ? systemMessage.content
                  : '') ?? '';
              
              try {
                // Fast PII detection (< 100ms)
                const guardianResult = await guardian.scanPrompt({
                  userInput,
                  systemPrompt,
                  provider,
                  model: modelId,
                  sandbox
                });
                
                // Block high-risk PII if configured
                if (guardianResult.action === 'BLOCK' && config.guardianConfig?.blockHighRisk !== false) {
                  throw new Error(`[Continum Guardian] Request blocked: ${guardianResult.reasoning}`);
                }
                
                // Redact medium-risk PII if configured
                if (guardianResult.action === 'REDACT' && config.guardianConfig?.redactMediumRisk !== false) {
                  params = {
                    ...params,
                    messages: params.messages.map(msg => {
                      if (msg.role === 'user') {
                        if (typeof msg.content === 'string') {
                          return { ...msg, content: guardianResult.cleanPrompt };
                        }
                        // For multimodal, only redact text parts
                        return {
                          ...msg,
                          content: Array.isArray(msg.content)
                            ? msg.content.map(part => 
                                part.type === 'text' || part.type === 'input_text'
                                  ? { ...part, text: guardianResult.cleanPrompt }
                                  : part
                              )
                            : msg.content
                        };
                      }
                      return msg;
                    })
                  };
                }
              } catch (error) {
                // Fail-safe: if guardian fails, allow call (unless strict mode)
                if (config.strictMirror) throw error;
                console.warn('[Continum Guardian] Scan failed, allowing call:', error);
              }
            }
            
            // Phase 2: LLM CALL (Full feature support - vision, streaming, tools, etc.)
            const result = await driver.call(modelId, params);
            
            // Phase 3: DETONATION (Shadow Audit)
            const detonationEnabled = config.detonationConfig?.enabled !== false && !params.skipDetonation;
            
            if (detonationEnabled && sandbox) {
              try {
                mirror.fire(sandbox, params, result);
              } catch (error) {
                // Never block user for audit failures
                console.warn('[Continum Detonation] Shadow audit failed:', error);
              }
            }
            
            // Phase 4: Notify SDK-level hook
            onCall(provider, modelId, params, result);
            
            return result;
          },
        };
      },
    });
  }
}
