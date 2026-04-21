import { SDK_VERSION } from './config';
import type { AuditPayload, ResolvedConfig } from './types';

/**
 * Resolve a fetch implementation that is guaranteed to work in Node.js.
 *
 * Node >=18 has global fetch, but it may not be set in all environments
 * (e.g. when running under certain test runners or older minor versions).
 * We fall back to the built-in https module via a thin wrapper if needed.
 */
async function getNodeFetch(): Promise<typeof fetch> {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }
  // Dynamic import so this compiles cleanly for environments that do have fetch
  const { default: nodeFetch } = await import('node-fetch' as any).catch(() => ({
    default: null,
  }));
  if (nodeFetch) return nodeFetch as unknown as typeof fetch;
  throw new Error(
    '[Continum] No fetch implementation available. ' +
    'Upgrade to Node >=18 or install the `node-fetch` package.'
  );
}

// ─── Async (fire-and-forget) ───────────────────────────────────────────────────

/**
 * Fire audit asynchronously (fire-and-forget).
 * Zero latency impact on the application.
 */
export async function fireAuditAsync(
  payload: AuditPayload,
  config: ResolvedConfig
): Promise<void> {
  try {
    const nodeFetch = await getNodeFetch();
    const url = `${config.baseUrl}/audit/ingest`;

    if (process.env.CONTINUM_DEBUG === 'true') {
      console.log('\n[SDK DEBUG] Sending audit:');
      console.log(`  URL: ${url}`);
      console.log(`  Sandbox: ${payload.sandboxSlug}`);
      console.log(`  Provider: ${payload.provider}`);
      console.log(`  Model: ${payload.model}`);
      console.log(`  API Key: ${config.apiKey.substring(0, 30)}...`);
    }

    const response = await nodeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-continum-key': config.apiKey,
      },
      body: JSON.stringify(buildAuditBody(payload)),
    });

    if (process.env.CONTINUM_DEBUG === 'true') {
      console.log(`  Response: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`  Error body: ${errorText}`);
      }
    } else if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Continum] Audit failed: ${response.status} ${response.statusText}`);
      console.error(`[Continum] Error: ${errorText}`);
    }
  } catch (error) {
    if (process.env.CONTINUM_DEBUG === 'true') {
      console.error('[SDK DEBUG] Audit error:', error);
    }
    if (config.onError) {
      config.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// ─── Sync (blocking) ──────────────────────────────────────────────────────────

/**
 * Fire audit synchronously (blocking).
 * Waits for audit result before returning.
 * Only use when blockOn is specified.
 */
export async function fireAuditSync(
  payload: AuditPayload,
  config: ResolvedConfig
): Promise<any> {
  const nodeFetch = await getNodeFetch();

  const response = await nodeFetch(`${config.baseUrl}/audit/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-continum-key': config.apiKey,
    },
    body: JSON.stringify(buildAuditBody(payload)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sync audit failed: HTTP ${response.status} — ${text}`);
  }

  return response.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAuditBody(payload: AuditPayload): Record<string, unknown> {
  return {
    sandboxSlug: payload.sandboxSlug,
    provider: payload.provider,
    model: payload.model,
    systemPrompt: payload.systemPrompt,
    userInput: payload.userInput,
    modelOutput: payload.modelOutput,
    thinkingBlock: payload.thinkingBlock,
    promptTokens: payload.promptTokens,
    outputTokens: payload.outputTokens,
    metadata: {
      ...payload.metadata,
      sandboxId: payload.sandboxId,
      sessionId: payload.sessionId,
      userId: payload.userId,
      isStreaming: payload.isStreaming,
      sdkVersion: payload.sdkVersion,
    },
  };
}

export function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
