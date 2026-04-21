import * as https from 'https';
import * as http from 'http';
import type { LLMPayload } from './types';

/**
 * Intercept an LLM call by monkey-patching http/https.request at the Node.js
 * transport layer — this catches ALL HTTP clients including the Anthropic SDK's
 * internal undici-based fetch, node-fetch, axios, got, etc.
 *
 * We do NOT patch global.fetch because:
 *  - The Anthropic SDK (and most modern SDKs) bundle their own HTTP stack
 *  - global.fetch patching only intercepts callers that explicitly use global.fetch
 *  - https.request is the lowest common denominator in Node.js
 */
export async function interceptLLMCall<T>(
  fn: () => Promise<T>
): Promise<{ result: T; payload: LLMPayload | null }> {
  let capturedPayload: LLMPayload | null = null;

  // Store originals
  const originalHttpsRequest = https.request;
  const originalHttpRequest = http.request;

  /**
   * Build a patched version of https.request / http.request that:
   * 1. Captures the request body as it is written
   * 2. Intercepts the response body for known LLM endpoints
   * 3. Extracts the LLM payload once both are available
   */
  function buildPatchedRequest(
    originalRequest: typeof https.request
  ): typeof https.request {
    return function patchedRequest(
      urlOrOptions: any,
      optionsOrCallback?: any,
      maybeCallback?: any
    ): any {
      // Normalise arguments — Node's http.request is overloaded
      let url: string | undefined;
      let options: any = {};
      let callback: ((...args: any[]) => any) | undefined;

      if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
        url = urlOrOptions.toString();
        if (typeof optionsOrCallback === 'function') {
          callback = optionsOrCallback;
        } else {
          options = optionsOrCallback ?? {};
          callback = maybeCallback;
        }
      } else {
        options = urlOrOptions ?? {};
        url =
          options.href ??
          (options.host
            ? `https://${options.host}${options.path ?? ''}`
            : undefined);
        callback = typeof optionsOrCallback === 'function'
          ? optionsOrCallback
          : maybeCallback;
      }

      // Only intercept known LLM endpoints
      if (!url || !isLLMEndpoint(url)) {
        return originalRequest(urlOrOptions, optionsOrCallback, maybeCallback);
      }

      // Make the real request
      const req = originalRequest(urlOrOptions, optionsOrCallback, maybeCallback);

      // Capture request body chunks as they are written
      const requestChunks: Buffer[] = [];
      const originalWrite = req.write.bind(req);
      const originalEnd = req.end.bind(req);

      req.write = function (chunk: any, ...args: any[]) {
        if (chunk) {
          requestChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          );
        }
        return originalWrite(chunk, ...args);
      };

      req.end = function (chunk?: any, ...args: any[]) {
        if (chunk) {
          requestChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          );
        }
        return originalEnd(chunk, ...args);
      };

      // Intercept the response
      req.on('response', (res: http.IncomingMessage) => {
        const responseChunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          responseChunks.push(chunk);
        });

        res.on('end', () => {
          // Only extract once — first successful LLM response wins
          if (capturedPayload) return;

          try {
            const requestBody = requestChunks.length
              ? JSON.parse(Buffer.concat(requestChunks).toString('utf8'))
              : null;
            const responseBody = JSON.parse(
              Buffer.concat(responseChunks).toString('utf8')
            );
            capturedPayload = extractPayload(url!, requestBody, responseBody);
          } catch {
            // Extraction failed — continue without audit
          }
        });
      });

      return req;
    } as typeof https.request;
  }

  // Patch both https and http
  (https as any).request = buildPatchedRequest(originalHttpsRequest);
  (http as any).request = buildPatchedRequest(originalHttpRequest);

  try {
    const result = await fn();
    return { result, payload: capturedPayload };
  } finally {
    // Always restore originals
    (https as any).request = originalHttpsRequest;
    (http as any).request = originalHttpRequest;
  }
}

// ─── Endpoint Detection ────────────────────────────────────────────────────────

function isLLMEndpoint(url: string): boolean {
  return (
    url.includes('api.openai.com') ||
    url.includes('api.anthropic.com') ||
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('api.azure.com') ||
    url.includes('bedrock-runtime')
  );
}

// ─── Payload Extraction ────────────────────────────────────────────────────────

function extractPayload(
  url: string,
  requestBody: any,
  responseBody: any
): LLMPayload | null {
  try {
    if (url.includes('api.openai.com')) {
      return extractOpenAIPayload(requestBody, responseBody);
    } else if (url.includes('api.anthropic.com')) {
      return extractAnthropicPayload(requestBody, responseBody);
    } else if (url.includes('generativelanguage.googleapis.com')) {
      return extractGeminiPayload(requestBody, responseBody);
    }
  } catch {
    // Extraction failed — return null
  }
  return null;
}

function extractOpenAIPayload(request: any, response: any): LLMPayload {
  const messages = request?.messages ?? [];
  const systemMessage = messages.find((m: any) => m.role === 'system');
  const userMessage = [...messages].reverse().find((m: any) => m.role === 'user');
  const choice = response?.choices?.[0];
  const message = choice?.message;

  return {
    provider: 'openai',
    model: response?.model ?? request?.model ?? 'unknown',
    systemPrompt: extractContent(systemMessage?.content),
    userInput: extractContent(userMessage?.content),
    modelOutput: message?.content ?? '',
    thinkingBlock: message?.reasoning_content,
    promptTokens: response?.usage?.prompt_tokens,
    outputTokens: response?.usage?.completion_tokens,
  };
}

function extractAnthropicPayload(request: any, response: any): LLMPayload {
  const messages = request?.messages ?? [];
  const userMessage = [...messages].reverse().find((m: any) => m.role === 'user');
  const content = response?.content?.[0];

  return {
    provider: 'anthropic',
    model: response?.model ?? request?.model ?? 'unknown',
    systemPrompt: extractContent(request?.system),
    userInput: extractContent(userMessage?.content),
    modelOutput: content?.text ?? '',
    thinkingBlock: content?.thinking,
    promptTokens: response?.usage?.input_tokens,
    outputTokens: response?.usage?.output_tokens,
  };
}

function extractGeminiPayload(request: any, response: any): LLMPayload {
  const contents = request?.contents ?? [];
  const userContent = [...contents].reverse().find((c: any) => c.role === 'user');
  const candidate = response?.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  return {
    provider: 'google',
    model: request?.model ?? 'gemini-pro',
    systemPrompt: request?.systemInstruction?.parts?.[0]?.text ?? '',
    userInput: userContent?.parts?.[0]?.text ?? '',
    modelOutput: part?.text ?? '',
    promptTokens: response?.usageMetadata?.promptTokenCount,
    outputTokens: response?.usageMetadata?.candidatesTokenCount,
  };
}

function extractContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');
  }
  return '';
}
