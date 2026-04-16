import { interceptLLMCall } from './interceptor';
import { fireAuditAsync, fireAuditSync, generateAuditId } from './transport';
import { getSandboxId } from './resolver';
import { resolveConfig, SDK_VERSION } from './config';
import { runViolationHandlers } from './handlers';
import type { ContinumConfig, ProtectOptions, AuditSignal, RiskLevel } from './types';

/**
 * Protect an LLM call with automatic compliance auditing
 * 
 * @param fn - The function that makes the LLM call
 * @param options - Optional configuration overrides
 * @returns The result of the LLM call
 * 
 * @example
 * ```typescript
 * const response = await protect(
 *   () => openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [{ role: 'user', content: 'Hello' }]
 *   }),
 *   { preset: 'customer-support' }
 * );
 * ```
 */
export async function protect<T>(
  fn: () => Promise<T>,
  config: ContinumConfig,
  options?: ProtectOptions
): Promise<T> {
  const resolvedConfig = resolveConfig(config, options);

  // Intercept the LLM call — patches fetch, runs fn(), restores fetch
  const { result, payload } = await interceptLLMCall(fn);

  // If interception yielded no payload (non-LLM function call), return as-is
  if (!payload) {
    return result;
  }

  // Attach session and user context
  const enrichedPayload = {
    ...payload,
    auditId: generateAuditId(),
    sandboxId: '', // Will be filled after resolution
    sandboxSlug: '', // Will be filled after resolution
    sessionId: options?.sessionId,
    userId: options?.userId,
    metadata: options?.metadata,
    sdkVersion: SDK_VERSION,
    isStreaming: false, // TODO: detect streaming
  };

  const blockOn = options?.blockOn ?? resolvedConfig.blockOn;

  if (blockOn) {
    // Blocking mode — await audit before returning result
    // Adds latency — only use when response safety > response speed
    const { sandboxId, sandboxSlug } = await getSandboxId(resolvedConfig);
    enrichedPayload.sandboxId = sandboxId;
    enrichedPayload.sandboxSlug = sandboxSlug;

    const signal = await fireAuditSync(enrichedPayload, resolvedConfig);

    if (shouldBlock(signal.riskLevel, blockOn)) {
      throw new ContinumBlockedError(signal);
    }

    await runViolationHandlers(signal, resolvedConfig, options);
    return result;
  }

  // Default — fire and forget — zero latency impact
  getSandboxId(resolvedConfig)
    .then(({ sandboxId, sandboxSlug }) => {
      enrichedPayload.sandboxId = sandboxId;
      enrichedPayload.sandboxSlug = sandboxSlug;
      return fireAuditAsync(enrichedPayload, resolvedConfig);
    })
    .catch(err => {
      if (resolvedConfig.onError) {
        resolvedConfig.onError(err);
      }
      // Never surface audit errors to the application user
    });

  return result;
}

/**
 * Check if a signal should block based on risk level threshold
 */
function shouldBlock(signalLevel: RiskLevel, blockOn: RiskLevel): boolean {
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return order.indexOf(signalLevel) >= order.indexOf(blockOn);
}

/**
 * Error thrown when an LLM call is blocked by Continum
 */
export class ContinumBlockedError extends Error {
  public readonly signal: AuditSignal;

  constructor(signal: AuditSignal) {
    super(
      `Blocked by Continum: ${signal.riskLevel} — ${signal.violations.join(', ')}`
    );
    this.name = 'ContinumBlockedError';
    this.signal = signal;
  }
}
