import { protect } from './protect';
import type { ContinumConfig, ProtectOptions, ViolationCode, ViolationHandler, RiskLevel } from './types';

/**
 * Continum client for global configuration
 * 
 * @example
 * ```typescript
 * import { continum } from '@continum/sdk';
 * 
 * continum.configure({
 *   apiKey: process.env.CONTINUM_API_KEY!,
 *   preset: 'customer-support',
 *   comply: ['GDPR', 'SOC2']
 * });
 * 
 * const response = await continum.protect(
 *   () => openai.chat.completions.create({...})
 * );
 * ```
 */
export class ContinumClient {
  private config: ContinumConfig | null = null;

  /**
   * Configure the Continum client with global settings
   */
  configure(config: ContinumConfig): this {
    this.config = config;
    return this;
  }

  /**
   * Protect an LLM call with compliance auditing
   */
  async protect<T>(fn: () => Promise<T>, options?: ProtectOptions): Promise<T> {
    if (!this.config) {
      throw new Error('Call continum.configure() before continum.protect()');
    }
    return protect(fn, this.config, options);
  }

  /**
   * Register a violation handler
   */
  onViolation(code: ViolationCode, handler: ViolationHandler): this {
    if (!this.config) {
      throw new Error('Call continum.configure() first');
    }
    this.config.onViolation = { ...this.config.onViolation, [code]: handler };
    return this;
  }

  /**
   * Register a risk level handler
   */
  onRiskLevel(level: RiskLevel, handler: ViolationHandler): this {
    if (!this.config) {
      throw new Error('Call continum.configure() first');
    }
    this.config.onRiskLevel = { ...this.config.onRiskLevel, [level]: handler };
    return this;
  }
}

/**
 * Global Continum client instance
 */
export const continum = new ContinumClient();
