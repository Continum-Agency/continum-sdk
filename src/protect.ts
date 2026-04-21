import { interceptLLMCall } from './interceptor';
import { fireAuditAsync, fireAuditSync, generateAuditId } from './transport';
import { getSandboxId } from './resolver';
import { resolveConfig, SDK_VERSION } from './config';
import { runViolationHandlers } from './handlers';
import type { ContinumConfig, ProtectOptions, AuditSignal, RiskLevel, AuditPayload } from './types';

/**
 * Protect an LLM call with automatic compliance auditing.
 *
 * @param fn - The function that makes the LLM call
 * @param config - Continum configuration
 * @param options - Optional per-call overrides
 * @returns The result of the LLM call
 *
 * @example
 * ```typescript
 * const response = await protect(
 *   () => openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [{ role: 'user', content: 'Hello' }]
 *   }),
 *   { apiKey: process.env.CONTINUM_API_KEY!, preset: 'customer-support' }
 * );
 * ```
 */
export async function protect<T>(
  fn: () => Promise<T>,
  config: ContinumConfig,
  options?: ProtectOptions
): Promise<T> {
  const resolvedConfig = resolveConfig(config, options);

  // Intercept the LLM call — patches https.request, runs fn(), restores it
  const { result, payload } = await interceptLLMCall(fn);

  // If interception yielded no payload (non-LLM function call), return as-is
  if (!payload) {
    return result;
  }

  // Build the full audit payload — immutable snapshot, no mutation after this
  const basePayload: AuditPayload = {
    ...payload,
    auditId: generateAuditId(),
    sandboxId: '',
    sandboxSlug: '',
    sessionId: options?.sessionId,
    userId: options?.userId,
    metadata: options?.metadata,
    sdkVersion: SDK_VERSION,
    isStreaming: false, // TODO: detect streaming
  };

  const blockOn = options?.blockOn ?? resolvedConfig.blockOn;

  if (blockOn) {
    // Blocking mode — await audit before returning result
    const { sandboxId, sandboxSlug } = await getSandboxId(resolvedConfig);

    const enrichedPayload: AuditPayload = { ...basePayload, sandboxId, sandboxSlug };
    const signal = await fireAuditSync(enrichedPayload, resolvedConfig);

    if (shouldBlock(signal.riskLevel, blockOn)) {
      throw new ContinumBlockedError(signal);
    }

    await runViolationHandlers(signal, resolvedConfig, options);
    return result;
  }

  // Default — fire and forget — zero latency impact on the caller.
  //
  // FIXED: We snapshot basePayload into a local const before the async chain
  // so concurrent calls to protect() cannot race on a shared mutable object.
  // Each invocation gets its own closure over its own payload snapshot.
  const payloadSnapshot = { ...basePayload };

  getSandboxId(resolvedConfig)
    .then(({ sandboxId, sandboxSlug }) => {
      // Produce a new object — never mutate payloadSnapshot
      const enrichedPayload: AuditPayload = {
        ...payloadSnapshot,
        sandboxId,
        sandboxSlug,
      };
      return fireAuditAsync(enrichedPayload, resolvedConfig);
    })
    .catch(err => {
      if (resolvedConfig.onError) {
        resolvedConfig.onError(err instanceof Error ? err : new Error(String(err)));
      }
      // Never surface audit errors to the application user
    });

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shouldBlock(signalLevel: RiskLevel, blockOn: RiskLevel): boolean {
  const order: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return order.indexOf(signalLevel) >= order.indexOf(blockOn);
}

// ─── Error ────────────────────────────────────────────────────────────────────

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
