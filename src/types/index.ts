// ─── Provider types ───────────────────────────────────────────────────────────

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'bedrock' | 'custom';

export interface Message {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  messages:     Message[];
  temperature?: number;
  maxTokens?:   number;
  systemPrompt?: string;
}

export interface ChatResult {
  content:       string;
  model:         string;
  provider:      Provider;
  promptTokens:  number;
  outputTokens:  number;
  thinkingBlock?: string;   // Reasoning trace from thinking models
  raw:           any;       // Full provider response
}

// ─── SDK config ───────────────────────────────────────────────────────────────

export interface ContinumConfig {
  // Your Continum project key — from POST /customers response
  continumKey: string;

  // Provider API keys — only stored on the developer's server
  openaiKey?:    string;
  anthropicKey?: string;
  geminiKey?:    string;

  // Continum backend endpoint
  apiEndpoint?: string;  // defaults to https://api.continum.io

  // Default sandbox slug — can be overridden per call
  defaultSandbox?: string;

  // Operating mode
  mode?: 'DETONATION' | 'GUARDIAN' | 'DUAL';
  // DETONATION: Shadow audit only (0ms latency, for testing)
  // GUARDIAN: Pre-LLM protection only (fast PII blocking)
  // DUAL: Both modes active (recommended for production)

  // Guardian configuration
  guardianConfig?: {
    blockHighRisk?: boolean;    // Block SSN, credit cards, etc.
    redactMediumRisk?: boolean; // Redact emails, phones, etc.
    localOnly?: boolean;        // Use only local patterns (fastest)
    customPatterns?: Array<{    // Custom PII patterns
      name: string;
      pattern: RegExp;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };

  // Whether to throw if the mirror call fails (default: false — never block the user)
  strictMirror?: boolean;
}

// ─── Call options ─────────────────────────────────────────────────────────────

export interface CallOptions extends ChatParams {
  // Override which sandbox to use for this specific call
  sandbox?: string;
}

// ─── Driver interface ─────────────────────────────────────────────────────────

export interface IProviderDriver {
  call(model: string, params: CallOptions): Promise<ChatResult>;
}
