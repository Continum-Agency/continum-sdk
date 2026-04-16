import { SDK_VERSION } from './config';
import type { AuditPayload, ResolvedConfig } from './types';

/**
 * Fire audit asynchronously (fire-and-forget)
 * Zero latency impact on the application
 */
export async function fireAuditAsync(
  payload: AuditPayload,
  config: ResolvedConfig
): Promise<void> {
  try {
    const url = `${config.baseUrl}/audit/ingest`;
    
    if (process.env.CONTINUM_DEBUG === 'true') {
      console.log('\n[SDK DEBUG] Sending audit:');
      console.log(`  URL: ${url}`);
      console.log(`  Sandbox: ${payload.sandboxSlug}`);
      console.log(`  Provider: ${payload.provider}`);
      console.log(`  Model: ${payload.model}`);
      console.log(`  API Key: ${config.apiKey.substring(0, 30)}...`);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-continum-key': config.apiKey,
      },
      body: JSON.stringify({
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
      }),
    });

    if (process.env.CONTINUM_DEBUG === 'true') {
      console.log(`  Response: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`  Error body: ${errorText}`);
      }
    }

    if (!response.ok && process.env.CONTINUM_DEBUG !== 'true') {
      // Log errors even when debug is off
      const errorText = await response.text();
      console.error(`[SDK] Audit failed: ${response.status} ${response.statusText}`);
      console.error(`[SDK] Error: ${errorText}`);
    }
  } catch (error) {
    // Never throw — audit failures should not break the application
    if (process.env.CONTINUM_DEBUG === 'true') {
      console.error('[SDK DEBUG] Audit error:', error);
    }
    if (config.onError) {
      config.onError(error as Error);
    }
  }
}

/**
 * Fire audit synchronously (blocking)
 * Waits for audit result before returning
 * Only use when blockOn is specified
 */
export async function fireAuditSync(
  payload: AuditPayload,
  config: ResolvedConfig
): Promise<any> {
  const response = await fetch(`${config.baseUrl}/audit/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-continum-key': config.apiKey,
    },
    body: JSON.stringify({
      sandboxSlug: payload.sandboxSlug, // ✅ FIXED: Use slug instead of ID
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
    }),
  });

  if (!response.ok) {
    throw new Error(`Sync audit failed: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Generate a unique audit ID
 */
export function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
