import type { LLMPayload } from './types';

/**
 * Intercept an LLM call by patching fetch, running the function, and restoring
 * Returns both the result and the extracted payload
 */
export async function interceptLLMCall<T>(
  fn: () => Promise<T>
): Promise<{ result: T; payload: LLMPayload | null }> {
  let capturedPayload: LLMPayload | null = null;

  // Store original fetch
  const originalFetch = global.fetch;

  // Patch fetch to intercept LLM calls
  global.fetch = async (input: string | Request | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

    // Call original fetch
    const response = await originalFetch(input, init);

    // Try to extract LLM payload from known providers
    if (isLLMEndpoint(url)) {
      try {
        const requestBody = init?.body ? JSON.parse(init.body as string) : null;
        const responseClone = response.clone();
        const responseBody = await responseClone.json();

        capturedPayload = extractPayload(url, requestBody, responseBody);
      } catch (error) {
        // Failed to extract — continue without audit
      }
    }

    return response;
  };

  try {
    // Run the function with patched fetch
    const result = await fn();
    return { result, payload: capturedPayload };
  } finally {
    // Always restore original fetch
    global.fetch = originalFetch;
  }
}

/**
 * Check if URL is an LLM endpoint
 */
function isLLMEndpoint(url: string): boolean {
  return (
    url.includes('api.openai.com') ||
    url.includes('api.anthropic.com') ||
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('api.azure.com') ||
    url.includes('bedrock-runtime')
  );
}

/**
 * Extract LLM payload from request/response
 */
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
  } catch (error) {
    // Extraction failed — return null
  }

  return null;
}

/**
 * Extract OpenAI payload
 */
function extractOpenAIPayload(request: any, response: any): LLMPayload {
  const messages = request.messages || [];
  const systemMessage = messages.find((m: any) => m.role === 'system');
  const userMessage = messages.findLast((m: any) => m.role === 'user');

  const choice = response.choices?.[0];
  const message = choice?.message;

  return {
    provider: 'openai',
    model: response.model || request.model || 'unknown',
    systemPrompt: systemMessage?.content || '',
    userInput: extractContent(userMessage?.content) || '',
    modelOutput: message?.content || '',
    thinkingBlock: message?.reasoning_content,
    promptTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

/**
 * Extract Anthropic payload
 */
function extractAnthropicPayload(request: any, response: any): LLMPayload {
  const messages = request.messages || [];
  const userMessage = messages.findLast((m: any) => m.role === 'user');

  const content = response.content?.[0];

  return {
    provider: 'anthropic',
    model: response.model || request.model || 'unknown',
    systemPrompt: request.system || '',
    userInput: extractContent(userMessage?.content) || '',
    modelOutput: content?.text || '',
    thinkingBlock: content?.thinking,
    promptTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
  };
}

/**
 * Extract Gemini payload
 */
function extractGeminiPayload(request: any, response: any): LLMPayload {
  const contents = request.contents || [];
  const userContent = contents.findLast((c: any) => c.role === 'user');

  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  return {
    provider: 'google',
    model: request.model || 'gemini-pro',
    systemPrompt: request.systemInstruction?.parts?.[0]?.text || '',
    userInput: userContent?.parts?.[0]?.text || '',
    modelOutput: part?.text || '',
    promptTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
  };
}

/**
 * Extract text content from message content (handles both string and array formats)
 */
function extractContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
  }

  return '';
}
