import { createHash } from 'crypto';
import type { ResolvedConfig } from './types';

/**
 * Compute a deterministic fingerprint for a sandbox configuration
 * Same config always produces same fingerprint for idempotent resolution
 */
export function computeFingerprint(config: ResolvedConfig): string {
  const stable = JSON.stringify({
    workspaceId: config.workspaceId,
    preset: config.preset,
    comply: config.comply?.slice().sort(),
    sandboxTypes: config.sandboxTypes?.slice().sort(),
    customRules: config.customRules?.slice().sort(),
  });

  return createHash('sha256').update(stable).digest('hex');
}
