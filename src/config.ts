import type { ContinumConfig, ProtectOptions, ResolvedConfig, Preset, SandboxType, ComplianceFramework } from './types';

const SDK_VERSION = '2.0.0';
const DEFAULT_BASE_URL = 'https://api.continum.co';

// ─── Preset to Sandbox Types Mapping ──────────────────────────────────────────

const PRESET_MAPPINGS: Record<Preset, SandboxType[]> = {
  'customer-support': ['PII_DETECTION', 'CONTENT_POLICY', 'BIAS_DETECTION'],
  'legal-ai': ['PII_DETECTION', 'LEGAL_COMPLIANCE', 'HALLUCINATION_DETECTION', 'BIAS_DETECTION'],
  'fintech-ai': ['PII_DETECTION', 'FINANCIAL_COMPLIANCE', 'SECURITY_AUDIT', 'BIAS_DETECTION'],
  'healthcare-ai': ['PII_DETECTION', 'CONTENT_POLICY', 'BIAS_DETECTION', 'HALLUCINATION_DETECTION'],
  'coding-assistant': ['SECURITY_AUDIT', 'SUPPLY_CHAIN_INTEGRITY', 'PROMPT_INJECTION'],
  'agent': ['AGENT_SAFETY', 'PROMPT_INJECTION', 'DATA_EXFILTRATION', 'SECURITY_AUDIT'],
  'content-generation': ['CONTENT_POLICY', 'BIAS_DETECTION', 'HALLUCINATION_DETECTION'],
  'internal-tool': ['PII_DETECTION', 'SECURITY_AUDIT'],
  'data-pipeline': ['PII_DETECTION', 'DATA_EXFILTRATION', 'SECURITY_AUDIT'],
  'education-ai': ['CONTENT_POLICY', 'BIAS_DETECTION', 'HALLUCINATION_DETECTION'],
};

// ─── Framework to Sandbox Types Mapping ───────────────────────────────────────

const FRAMEWORK_MAPPINGS: Record<ComplianceFramework, SandboxType[]> = {
  'GDPR': ['PII_DETECTION', 'DATA_EXFILTRATION'],
  'CCPA': ['PII_DETECTION', 'DATA_EXFILTRATION'],
  'HIPAA': ['PII_DETECTION', 'SECURITY_AUDIT'],
  'SOC2': ['SECURITY_AUDIT', 'DATA_EXFILTRATION'],
  'ISO_27001': ['SECURITY_AUDIT', 'DATA_EXFILTRATION'],
  'EU_AI_ACT': ['BIAS_DETECTION', 'HALLUCINATION_DETECTION', 'CONTENT_POLICY'],
  'FINRA': ['FINANCIAL_COMPLIANCE', 'HALLUCINATION_DETECTION'],
  'FCA': ['FINANCIAL_COMPLIANCE', 'HALLUCINATION_DETECTION'],
  'PCI_DSS': ['PII_DETECTION', 'SECURITY_AUDIT'],
  'PDPA': ['PII_DETECTION', 'DATA_EXFILTRATION'],
  'PIPEDA': ['PII_DETECTION', 'DATA_EXFILTRATION'],
  'UK_DPA_2018': ['PII_DETECTION', 'DATA_EXFILTRATION'],
  'NIST_AI_RMF': ['SECURITY_AUDIT', 'BIAS_DETECTION', 'HALLUCINATION_DETECTION'],
};

// ─── Configuration Resolution ─────────────────────────────────────────────────

export function resolveConfig(
  globalConfig: ContinumConfig,
  options?: ProtectOptions
): ResolvedConfig {
  const merged = {
    ...globalConfig,
    ...options,
    comply: [...(globalConfig.comply ?? []), ...(options?.comply ?? [])],
    onViolation: { ...globalConfig.onViolation, ...options?.onViolation },
    onRiskLevel: { ...globalConfig.onRiskLevel, ...options?.onRiskLevel },
  };

  return {
    workspaceId: extractWorkspaceId(merged.apiKey),
    apiKey: merged.apiKey,
    preset: merged.preset,
    comply: merged.comply.length > 0 ? merged.comply : undefined,
    sandboxTypes: merged.sandbox?.types,
    customRules: merged.customRules ?? merged.sandbox?.customRules ?? [],
    environment: merged.environment ?? 'production',
    region: merged.region ?? merged.sandbox?.region ?? 'us-east-1',
    local: merged.local ?? false,
    blockOn: merged.blockOn ?? merged.sandbox?.blockOn,
    baseUrl: merged.baseUrl ?? DEFAULT_BASE_URL,
    detectedProviders: [],
    onViolation: merged.onViolation,
    onRiskLevel: merged.onRiskLevel,
    onError: merged.onError,
  };
}

export function resolveSandboxTypes(config: {
  preset?: Preset;
  comply?: ComplianceFramework[];
  sandboxTypes?: SandboxType[];
}): SandboxType[] {
  // Direct specification takes precedence
  if (config.sandboxTypes && config.sandboxTypes.length > 0) {
    return config.sandboxTypes;
  }

  const types = new Set<SandboxType>();

  // Add types from preset
  if (config.preset) {
    const presetTypes = PRESET_MAPPINGS[config.preset];
    if (presetTypes) {
      presetTypes.forEach(t => types.add(t));
    }
  }

  // Add types from compliance frameworks
  if (config.comply && config.comply.length > 0) {
    config.comply.forEach(framework => {
      const frameworkTypes = FRAMEWORK_MAPPINGS[framework];
      if (frameworkTypes) {
        frameworkTypes.forEach(t => types.add(t));
      }
    });
  }

  // Default if nothing specified
  if (types.size === 0) {
    return ['PII_DETECTION', 'SECURITY_AUDIT'];
  }

  return Array.from(types);
}

export function resolveFrameworks(comply?: ComplianceFramework[]): ComplianceFramework[] {
  return comply ?? [];
}

function extractWorkspaceId(apiKey: string): string {
  // API keys are in format: ck_live_workspaceId_randomString
  // or ck_test_workspaceId_randomString
  const parts = apiKey.split('_');
  if (parts.length >= 3) {
    return parts[2];
  }
  throw new Error('Invalid API key format');
}

export function isLocalMode(config: ResolvedConfig): boolean {
  return (
    config.local === true ||
    process.env.CONTINUM_LOCAL === 'true' ||
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test'
  );
}

export { SDK_VERSION };
