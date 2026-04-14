// ─── Core Types ───────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ComplianceFramework =
  | 'GDPR' | 'CCPA' | 'HIPAA' | 'SOC2' | 'ISO_27001'
  | 'EU_AI_ACT' | 'FINRA' | 'FCA' | 'PCI_DSS' | 'PDPA'
  | 'PIPEDA' | 'UK_DPA_2018' | 'NIST_AI_RMF';

export type Preset =
  | 'customer-support'
  | 'legal-ai'
  | 'fintech-ai'
  | 'healthcare-ai'
  | 'coding-assistant'
  | 'agent'
  | 'content-generation'
  | 'internal-tool'
  | 'data-pipeline'
  | 'education-ai';

export type SandboxType =
  | 'PII_DETECTION'
  | 'BIAS_DETECTION'
  | 'SECURITY_AUDIT'
  | 'PROMPT_INJECTION'
  | 'DATA_EXFILTRATION'
  | 'AGENT_SAFETY'
  | 'HALLUCINATION_DETECTION'
  | 'CONTENT_POLICY'
  | 'FINANCIAL_COMPLIANCE'
  | 'LEGAL_COMPLIANCE'
  | 'MULTI_TURN_ATTACK'
  | 'SUPPLY_CHAIN_INTEGRITY'
  | 'FULL_SPECTRUM'
  | 'CUSTOM';

export type ViolationCode =
  | 'PII_LEAK' | 'FINANCIAL_DATA' | 'HEALTH_DATA' | 'BIOMETRIC_DATA'
  | 'CREDENTIAL_LEAK' | 'LOCATION_DATA' | 'INFERRED_PII' | 'COMBINATION_PII'
  | 'SENSITIVE_CHARACTERISTIC' | 'DEVICE_IDENTIFIER' | 'PSEUDONYM_REIDENTIFICATION'
  | 'CODE_INJECTION' | 'SQL_INJECTION' | 'COMMAND_INJECTION' | 'SSRF' | 'XSS'
  | 'SECRET_LEAK' | 'DANGEROUS_INSTRUCTIONS' | 'MALWARE_GENERATION'
  | 'INFRASTRUCTURE_DISCLOSURE' | 'CRYPTO_WEAKNESS' | 'EXPLOIT_CODE'
  | 'DIRECT_PROMPT_INJECTION' | 'INDIRECT_PROMPT_INJECTION' | 'JAILBREAK_ATTEMPT'
  | 'SYSTEM_PROMPT_EXTRACTION' | 'GOAL_HIJACKING' | 'PERSONA_OVERRIDE'
  | 'INSTRUCTION_SMUGGLING' | 'RAG_POISONING' | 'TOOL_OUTPUT_INJECTION'
  | 'CRESCENDO_ATTACK' | 'MANY_SHOT_JAILBREAK' | 'CONTEXT_EXHAUSTION'
  | 'DATA_EXFILTRATION' | 'CROSS_USER_LEAK' | 'CONFIG_EXPOSURE'
  | 'TRAINING_DATA_LEAK' | 'WEBHOOK_ABUSE' | 'COVERT_CHANNEL'
  | 'IRREVERSIBLE_ACTION' | 'SCOPE_CREEP' | 'PRIVILEGE_ESCALATION'
  | 'DECEPTIVE_ALIGNMENT' | 'RESOURCE_EXHAUSTION' | 'UNBOUNDED_RECURSION'
  | 'TOOL_CHAIN_POISONING' | 'REWARD_HACKING' | 'MULTI_AGENT_MANIPULATION'
  | 'CSAM' | 'CHILD_GROOMING' | 'HATE_SPEECH' | 'SELF_HARM_FACILITATION'
  | 'RADICALISATION' | 'HARASSMENT' | 'DOXXING' | 'HEALTH_MISINFORMATION'
  | 'FACTUAL_HALLUCINATION' | 'CITATION_HALLUCINATION' | 'EXPERT_IMPERSONATION'
  | 'FALSE_CERTAINTY' | 'TEMPORAL_CONFUSION' | 'MEDICAL_HALLUCINATION'
  | 'UNLICENSED_FINANCIAL_ADVICE' | 'MARKET_MANIPULATION' | 'INSIDER_TRADING'
  | 'FRAUD_ENABLEMENT' | 'MONEY_LAUNDERING' | 'SANCTIONS_EVASION'
  | 'UNAUTHORISED_LEGAL_ADVICE' | 'COPYRIGHT_INFRINGEMENT' | 'DEFAMATION_RISK'
  | 'GDPR_VIOLATION' | 'HIPAA_VIOLATION' | 'PRIVACY_INVASION'
  | 'GRADUAL_ESCALATION' | 'CONTEXT_POISONING' | 'ASSUMED_CONSENT'
  | 'JAILBREAK_CHAINING' | 'TRUST_EXPLOITATION' | 'INSTRUCTION_LAUNDERING'
  | 'TEMPLATE_INJECTION' | 'THIRD_PARTY_POISONING' | 'VECTOR_STORE_POISONING'
  | 'IDENTITY_SPOOFING' | 'VERSION_MANIPULATION'
  | `CUSTOM_${string}`;

// ─── Configuration Types ──────────────────────────────────────────────────────

export interface ContinumConfig {
  apiKey: string;
  preset?: Preset;
  comply?: ComplianceFramework[];
  sandbox?: DirectSandboxConfig;
  customRules?: string[];
  region?: string;
  local?: boolean;
  blockOn?: RiskLevel;
  alerts?: {
    slack?: string;
    email?: string;
    pagerduty?: string;
  };
  onViolation?: Partial<Record<ViolationCode, ViolationHandler>>;
  onRiskLevel?: Partial<Record<RiskLevel, ViolationHandler>>;
  onError?: (error: Error) => void;
  baseUrl?: string;
}

export interface DirectSandboxConfig {
  id?: string;
  types?: SandboxType[];
  frameworks?: ComplianceFramework[];
  customRules?: string[];
  region?: string;
  retention?: string;
  blockOn?: RiskLevel;
}

export interface ProtectOptions {
  preset?: Preset;
  comply?: ComplianceFramework[];
  sandbox?: DirectSandboxConfig;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, string>;
  blockOn?: RiskLevel;
  onViolation?: Partial<Record<ViolationCode, ViolationHandler>>;
  onRiskLevel?: Partial<Record<RiskLevel, ViolationHandler>>;
}

export type ViolationHandler = (signal: AuditSignal) => void | Promise<void>;

// ─── Signal Types ─────────────────────────────────────────────────────────────

export interface AuditSignal {
  auditId: string;
  sandboxId: string;
  riskLevel: RiskLevel;
  violations: ViolationCode[];
  piiDetected: boolean;
  reasoning: string;
  regulation: ComplianceFramework[];
  provider: string;
  model: string;
  durationMs: number;
  timestamp: string;
  sandboxTypes: SandboxType[];
  sessionId?: string;
  userId?: string;
  isBlocked: boolean;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

export interface ResolvedConfig {
  workspaceId: string;
  apiKey: string;
  preset?: Preset;
  comply?: ComplianceFramework[];
  sandboxTypes?: SandboxType[];
  customRules?: string[];
  region: string;
  local: boolean;
  blockOn?: RiskLevel;
  baseUrl: string;
  detectedProviders: string[];
  onViolation?: Partial<Record<ViolationCode, ViolationHandler>>;
  onRiskLevel?: Partial<Record<RiskLevel, ViolationHandler>>;
  onError?: (error: Error) => void;
}

export interface SandboxResolution {
  sandboxId: string;
  sandboxSlug: string; // ✅ ADDED: Slug for audit ingestion
  sandboxTypes: SandboxType[];
  name: string;
  frameworks: ComplianceFramework[];
  customRules: string[];
  blockOn: RiskLevel | null;
  detectionStatus: 'detecting' | 'confirmed';
  color: string;
  isNew: boolean;
}

export interface DetectionSignals {
  dependencies?: string[];
  envVarNames?: string[];
  routePattern?: string;
  appName?: string;
  systemPromptHash?: string;
}

export interface AuditPayload {
  auditId: string;
  sandboxId: string;
  sandboxSlug: string; // ✅ ADDED: Slug for audit ingestion
  provider: string;
  model: string;
  systemPrompt: string;
  userInput: string;
  modelOutput: string;
  thinkingBlock?: string;
  promptTokens?: number;
  outputTokens?: number;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, string>;
  sdkVersion: string;
  isStreaming: boolean;
}

export interface LLMPayload {
  provider: string;
  model: string;
  systemPrompt: string;
  userInput: string;
  modelOutput: string;
  thinkingBlock?: string;
  promptTokens?: number;
  outputTokens?: number;
}
