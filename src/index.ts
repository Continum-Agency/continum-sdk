/**
 * @continum/sdk v2.0.0
 * 
 * Protection-first AI compliance in one line
 * 
 * @example
 * ```typescript
 * import { protect } from '@continum/sdk';
 * 
 * const response = await protect(
 *   () => openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [{ role: 'user', content: 'Hello' }]
 *   }),
 *   {
 *     apiKey: process.env.CONTINUM_API_KEY!,
 *     preset: 'customer-support'
 *   }
 * );
 * ```
 * 
 * @example With global configuration
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

export { protect, ContinumBlockedError } from './protect';
export { continum } from './client';

// Re-export all types
export type {
  RiskLevel,
  ViolationCode,
  ComplianceFramework,
  Preset,
  SandboxType,
  AuditSignal,
  ContinumConfig,
  ProtectOptions,
  ViolationHandler,
  DirectSandboxConfig,
} from './types';
