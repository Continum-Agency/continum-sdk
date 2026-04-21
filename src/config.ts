import type { ContinumConfig, ProtectOptions, ResolvedConfig, Preset, SandboxType, ComplianceFramework } from './types';
import packageJson from '../package.json';

export const SDK_VERSION: string = packageJson.version;
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
    // extractWorkspaceId no longer throws — returns '' on unrecognised format
    // so the SDK degrades gracefully instead of silently swallowing everything
    workspaceId: extractWorkspaceId(merged.apiKey),
    apiKey: merged.apiKey,
    preset: merged.preset,
    comply: merged.comply.length > 0 ? merged.comply : undefined,
    sandboxTypes: merged.sandbox?.types,
    customRules: merged.customRules ?? merged.sandbox?.customRules ?? [],
    region: merged.region ?? merged.sandbox?.region ?? 'us-east-1',
    blockOn: merged.blockOn ?? merged.sandbox?.blockOn,
    baseUrl: DEFAULT_BASE_URL,
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
  if (config.sandboxTypes && config.sandboxTypes.length > 0) {
    return config.sandboxTypes;
  }

  const types = new Set<SandboxType>();

  if (config.preset) {
    PRESET_MAPPINGS[config.preset]?.forEach(t => types.add(t));
  }

  config.comply?.forEach(framework => {
    FRAMEWORK_MAPPINGS[framework]?.forEach(t => types.add(t));
  });

  if (types.size === 0) {
    return ['PII_DETECTION', 'SECURITY_AUDIT'];
  }

  return Array.from(types);
}

export function resolveFrameworks(comply?: ComplianceFramework[]): ComplianceFramework[] {
  return comply ?? [];
}

/**
 * Extract workspace ID from API key.
 * Expected format: ctn_live_<workspaceId>_<key>  or  ctn_test_<workspaceId>_<key>
 *
 * CHANGED: No longer throws on invalid format. Returns '' so that misconfigured
 * keys fail loudly at the API (401) rather than silently at SDK init, which was
 * causing the entire audit pipeline to be swallowed by .catch() with no signal.
 */
function extractWorkspaceId(apiKey: string): string {
  if (!apiKey) return '';
  const parts = apiKey.split('_');
  if (
    parts.length >= 4 &&
    parts[0] === 'ctn' &&
    (parts[1] === 'live' || parts[1] === 'test')
  ) {
    return parts[2];
  }
  // Return empty string — resolver will get a 401/400 from the API with a clear
  // error message rather than throwing here and being silently caught
  return '';
}
