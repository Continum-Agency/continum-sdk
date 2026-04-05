/**
 * Batch processing utilities for efficient LLM operations
 */

import type { CallOptions, ChatResult } from '../types';

export interface BatchCallConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  params: CallOptions;
}

export interface BatchResult {
  success: boolean;
  result?: ChatResult;
  error?: Error;
  index: number;
}

/**
 * Execute batch calls with concurrency control
 */
export async function executeBatch(
  calls: BatchCallConfig[],
  executor: (call: BatchCallConfig) => Promise<ChatResult>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<BatchResult[]> {
  const concurrency = options.concurrency ?? 5;
  const results: BatchResult[] = [];
  let completed = 0;

  // Process in chunks
  for (let i = 0; i < calls.length; i += concurrency) {
    const chunk = calls.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map((call, idx) =>
        executor(call).then(result => ({ call, result, index: i + idx }))
      )
    );

    for (const settled of chunkResults) {
      if (settled.status === 'fulfilled') {
        results.push({
          success: true,
          result: settled.value.result,
          index: settled.value.index,
        });
      } else {
        results.push({
          success: false,
          error: settled.reason,
          index: i + results.filter(r => !r.success).length,
        });
      }
      
      completed++;
      if (options.onProgress) {
        options.onProgress(completed, calls.length);
      }
    }
  }

  return results;
}

/**
 * Retry a single call with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxAttempts - 1 || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}
