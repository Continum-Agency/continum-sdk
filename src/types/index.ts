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

// ─── API-aligned types ────────────────────────────────────────────────────────

export type SandboxType = 
  | 'PII_DETECTION'
  | 'BIAS_DETECTION'
  | 'SECURITY_AUDIT'
  | 'PROMPT_INJECTION'
  | 'DATA_EXFILTRATION'
  | 'REGULATORY_COMPLIANCE'
  | 'AGENT_SAFETY'
  | 'HALLUCINATION_DETECTION'
  | 'CONTENT_POLICY'
  | 'FINANCIAL_COMPLIANCE'
  | 'LEGAL_COMPLIANCE'
  | 'MULTI_TURN_ATTACK'
  | 'SUPPLY_CHAIN_INTEGRITY'
  | 'FULL_SPECTRUM'
  | 'CUSTOM';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type GuardianAction = 'ALLOW' | 'REDACT' | 'BLOCK';

export type GuardianActionConfig = 'BLOCK_ON_DETECT' | 'REDACT_AND_CONTINUE' | 'ALLOW_ALL';

export type Region = 'EU' | 'US' | 'RW' | 'UG' | 'GLOBAL';

export type ComplianceFramework = 'GDPR' | 'SOC2' | 'ISO27001' | 'HIPAA';

export type EntityType = 
  | 'EMAIL' 
  | 'SSN' 
  | 'PASSPORT' 
  | 'CREDIT_CARD' 
  | 'PHONE' 
  | 'HEALTH_ID' 
  | 'ADDRESS'
  | 'SENSITIVE_TOPIC';

export interface DetectedEntity {
  type: EntityType;
  originalValue: string;
  redactedValue: string;
  start: number;
  end: number;
  confidence: number;
  severity: RiskLevel;
}

export interface SandboxConfig {
  id: string;
  customerId: string;
  name: string;
  slug: string;
  description?: string;
  sandboxType: SandboxType;
  customRules: string[];
  alertThreshold: RiskLevel;
  guardianAction: GuardianActionConfig;
  region: Region;
  regulations: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSandboxDto {
  slug: string;
  name: string;
  description?: string;
  sandboxType: SandboxType;
  customRules?: string[];
  alertThreshold?: RiskLevel;
  guardianAction?: GuardianActionConfig;
  region?: Region;
  regulations?: string[];
}

export interface UpdateSandboxDto {
  name?: string;
  description?: string;
  customRules?: string[];
  alertThreshold?: RiskLevel;
  guardianAction?: GuardianActionConfig;
  region?: Region;
  regulations?: string[];
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

  // Organization context (for team features)
  organizationId?: string;
  accountType?: 'INDIVIDUAL' | 'ORGANIZATION';

  // Guardian configuration for PII protection
  guardianConfig?: {
    enabled?: boolean;          // Enable pre-LLM protection (default: true)
    action?: GuardianActionConfig; // Guardian action mode
    blockHighRisk?: boolean;    // Block SSN, credit cards, etc. (default: true) - DEPRECATED: use action instead
    redactMediumRisk?: boolean; // Redact emails, phones, etc. (default: true) - DEPRECATED: use action instead
    localOnly?: boolean;        // Use only local patterns (fastest)
    customPatterns?: Array<{    // Custom PII patterns
      name: string;
      pattern: RegExp;
      riskLevel: RiskLevel;
    }>;
  };

  // Detonation configuration for shadow auditing
  detonationConfig?: {
    enabled?: boolean;  // Enable shadow auditing (default: true)
  };

  // Retry configuration for resilience
  retryConfig?: {
    enabled?: boolean;          // Enable automatic retries (default: true)
    maxAttempts?: number;       // Max retry attempts (default: 3)
    backoffMultiplier?: number; // Exponential backoff multiplier (default: 2)
    initialDelayMs?: number;    // Initial retry delay (default: 1000)
  };

  // Provider fallback configuration
  fallbackConfig?: {
    enabled?: boolean;  // Enable provider fallback (default: false)
    fallbackOrder?: Array<{
      provider: Provider;
      model: string;
    }>;
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
  // Disable retry for this specific call
  skipRetry?: boolean;
  // Runtime metadata for compliance tracking
  metadata?: {
    userId?: string;              // End user identifier
    sessionId?: string;           // Session/conversation ID
    applicationContext?: string;  // Where in app this call happened
    userRole?: string;            // User's role/permissions
    ipAddress?: string;           // User's IP (for geo-compliance)
    tags?: string[];              // Custom tags for filtering
    customFields?: Record<string, any>; // Extensible metadata
  };
}

// ─── Driver interface ─────────────────────────────────────────────────────────

export interface IProviderDriver {
  call(model: string, params: CallOptions): Promise<ChatResult>;
}
