import { computeFingerprint } from './fingerprint';
import { resolveSandboxTypes, resolveFrameworks, SDK_VERSION } from './config';
import type { ResolvedConfig, SandboxResolution, DetectionSignals } from './types';

// Process-level cache — resolved once per cold start
const sandboxCache = new Map<string, { sandboxId: string; sandboxSlug: string }>(); // fingerprint → {sandboxId, sandboxSlug}

/**
 * Get or resolve sandbox ID and slug for the given configuration
 * Uses process-level caching for zero-latency on subsequent calls
 */
export async function getSandboxId(config: ResolvedConfig): Promise<{ sandboxId: string; sandboxSlug: string }> {
  const fingerprint = computeFingerprint(config);

  if (sandboxCache.has(fingerprint)) {
    return sandboxCache.get(fingerprint)!;
  }

  const sandbox = await resolveSandboxFromAPI(config, fingerprint);
  const cacheEntry = { sandboxId: sandbox.sandboxId, sandboxSlug: sandbox.sandboxSlug };
  sandboxCache.set(fingerprint, cacheEntry);

  return cacheEntry;
}

/**
 * Call the API to resolve or create a sandbox
 */
async function resolveSandboxFromAPI(
  config: ResolvedConfig,
  fingerprint: string
): Promise<SandboxResolution> {
  const signals = gatherDetectionSignals();
  const sandboxTypes = resolveSandboxTypes({
    preset: config.preset,
    comply: config.comply,
    sandboxTypes: config.sandboxTypes,
  });

  const url = `${config.baseUrl}/internal/workspace/resolve-sandbox`;

  if (process.env.CONTINUM_DEBUG === 'true') {
    console.log('\n[SDK DEBUG] Resolving sandbox:');
    console.log(`  URL: ${url}`);
    console.log(`  Preset: ${config.preset}`);
    console.log(`  Comply: ${config.comply?.join(', ')}`);
    console.log(`  Sandbox Types: ${sandboxTypes.join(', ')}`);
    console.log(`  API Key: ${config.apiKey.substring(0, 30)}...`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-continum-key': config.apiKey,
    },
    body: JSON.stringify({
      fingerprint,
      preset: config.preset,
      comply: config.comply,
      sandboxTypes,
      customRules: config.customRules,
      providers: config.detectedProviders,
      sdkVersion: SDK_VERSION,
      detectionSignals: signals,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (process.env.CONTINUM_DEBUG === 'true') {
      console.error(`[SDK DEBUG] Sandbox resolution failed: ${response.status}`);
      console.error(`[SDK DEBUG] Error: ${text}`);
    }
    throw new Error(`Sandbox resolution failed: HTTP ${response.status} — ${text}`);
  }

  const result = await response.json() as SandboxResolution;

  if (process.env.CONTINUM_DEBUG === 'true') {
    console.log(`[SDK DEBUG] Sandbox resolved:`);
    console.log(`  ID: ${result.sandboxId}`);
    console.log(`  Slug: ${result.sandboxSlug}`);
    console.log(`  Name: ${result.name}`);
    console.log(`  Is New: ${result.isNew}`);
  }

  return result;
}

/**
 * Gather detection signals from the runtime environment
 */
function gatherDetectionSignals(): DetectionSignals {
  const signals: DetectionSignals = {};

  // Read package.json if available — for dependency signals
  try {
    const pkg = require(process.cwd() + '/package.json');
    signals.dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch {
    // package.json not available — continue
  }

  // Read env var names — never values
  signals.envVarNames = Object.keys(process.env).filter(
    k => !['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'PWD'].includes(k)
  );

  return signals;
}

/**
 * Clear the sandbox cache (useful for testing)
 */
export function clearSandboxCache(): void {
  sandboxCache.clear();
}
