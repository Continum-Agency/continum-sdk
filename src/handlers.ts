import type { AuditSignal, ResolvedConfig, ProtectOptions } from './types';

/**
 * Run violation handlers for a signal
 */
export async function runViolationHandlers(
  signal: AuditSignal,
  config: ResolvedConfig,
  options?: ProtectOptions
): Promise<void> {
  const handlers = { ...config.onViolation, ...options?.onViolation };
  const riskHandlers = { ...config.onRiskLevel, ...options?.onRiskLevel };

  // Run violation-specific handlers
  for (const violation of signal.violations) {
    const handler = handlers[violation];
    if (handler) {
      try {
        await handler(signal);
      } catch (error) {
        if (config.onError) {
          config.onError(error as Error);
        }
      }
    }
  }

  // Run risk-level handler
  const riskHandler = riskHandlers[signal.riskLevel];
  if (riskHandler) {
    try {
      await riskHandler(signal);
    } catch (error) {
      if (config.onError) {
        config.onError(error as Error);
      }
    }
  }
}
