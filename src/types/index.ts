// ─── Provider types ───────────────────────────────────────────────────────────

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'bedrock' | 'custom';

export interface Message {
  role:    'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'text' | 'image_url' | 'input_text' | 'input_image';
  text?: string;
  image_url?: string | { url: string; detail?: 'low' | 'high' | 'auto' };
}

export interface ChatParams {
  messages:     Message[];
  temperature?: number;
  maxTokens?:   number;
  systemPrompt?: string;
  // Full LLM feature support
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  reasoning_effort?: 'low' | 'medium' | 'high';
  // Pass any additional provider-specific parameters
  [key: string]: any;
}

export interface ChatResult {
  content:       string;
  model:         string;
  provider:      Provider;
  promptTokens:  number;
  outputTokens:  number;
  thinkingBlock?: string;   // Reasoning trace from thinking models
  finishReason?: string;
  toolCalls?: any[];
  raw:           any;       // Full provider response
}

// ─── SDK config ───────────────────────────────────────────────────────────────

export interface ContinumConfig {
  // Your Continum project key — from POST /customers response
  continumKey: string;

  // Unified API keys — provide only the ones you need
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };

  // Legacy support (deprecated but still works)
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;

  // Default sandbox slug — can be overridden per call
  defaultSandbox?: string;

  // Guardian configuration for PII protection
  guardianConfig?: {
    enabled?: boolean;          // Enable pre-LLM protection (default: true)
    blockHighRisk?: boolean;    // Block SSN, credit cards, etc. (default: true)
    redactMediumRisk?: boolean; // Redact emails, phones, etc. (default: true)
    localOnly?: boolean;        // Use only local patterns (fastest)
    customPatterns?: Array<{    // Custom PII patterns
      name: string;
      pattern: RegExp;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };

  // Detonation configuration for shadow auditing
  detonationConfig?: {
    enabled?: boolean;  // Enable shadow auditing (default: true)
  };

  // Whether to throw if the mirror call fails (default: false — never block the user)
  strictMirror?: boolean;
}

// ─── Call options ─────────────────────────────────────────────────────────────

export interface CallOptions extends ChatParams {
  // Override which sandbox to use for this specific call
  sandbox?: string;
  // Disable guardian for this specific call
  skipGuardian?: boolean;
  // Disable detonation for this specific call
  skipDetonation?: boolean;
}

// ─── Driver interface ─────────────────────────────────────────────────────────

export interface IProviderDriver {
  call(model: string, params: CallOptions): Promise<ChatResult>;
}
