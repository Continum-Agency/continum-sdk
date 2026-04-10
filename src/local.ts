import type { AuditPayload, ResolvedConfig } from './types';

const RISK_COLORS = {
  LOW: '\x1b[32m', // green
  MEDIUM: '\x1b[33m', // amber
  HIGH: '\x1b[31m', // red
  CRITICAL: '\x1b[35m', // magenta
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

/**
 * Run a local audit without calling the cloud API
 * Prints results to terminal for development
 */
export async function localAudit(
  payload: AuditPayload,
  config: ResolvedConfig
): Promise<void> {
  const start = Date.now();

  // Run a lightweight local audit
  const signal = await runLocalAudit(payload);

  const ms = Date.now() - start;

  if (signal.violations.length === 0) {
    console.log(
      `${DIM}[CONTINUM]${RESET} ${RISK_COLORS.LOW}✓ audit:clean${RESET}` +
        ` — ${signal.riskLevel}` +
        ` — ${payload.model}` +
        ` — ${ms}ms`
    );
    return;
  }

  console.log(
    `\n${DIM}[CONTINUM]${RESET} ${RISK_COLORS[signal.riskLevel as keyof typeof RISK_COLORS]}⚠ audit:violation${RESET}` +
      ` — ${signal.riskLevel}`
  );
  console.log(`  ${DIM}Model:${RESET}     ${payload.model}`);
  console.log(`  ${DIM}Sandbox:${RESET}   ${config.sandboxTypes?.join(', ')}`);

  signal.violations.forEach((v: string) => {
    console.log(`  ${DIM}Violation:${RESET} ${RISK_COLORS[signal.riskLevel as keyof typeof RISK_COLORS]}${v}${RESET}`);
  });

  console.log(`  ${DIM}Reasoning:${RESET} ${signal.reasoning}`);
  console.log(`  ${DIM}Duration:${RESET}  ${ms}ms\n`);
}

/**
 * Run a simple local audit using pattern matching
 * This is a lightweight version that doesn't call Bedrock
 */
async function runLocalAudit(payload: AuditPayload): Promise<any> {
  const violations: string[] = [];
  let riskLevel = 'LOW';

  const text = `${payload.userInput} ${payload.modelOutput}`.toLowerCase();

  // Simple PII detection patterns
  if (
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text) ||
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text) ||
    /\b\d{3}-\d{2}-\d{4}\b/.test(text)
  ) {
    violations.push('PII_LEAK');
    riskLevel = 'HIGH';
  }

  // Simple credential detection
  if (
    /password|api[_-]?key|secret|token|bearer/i.test(text) &&
    /[a-z0-9]{20,}/i.test(text)
  ) {
    violations.push('CREDENTIAL_LEAK');
    riskLevel = 'CRITICAL';
  }

  // Simple injection detection
  if (
    /union\s+select|drop\s+table|<script|javascript:|onerror=/i.test(text)
  ) {
    violations.push('CODE_INJECTION');
    riskLevel = 'HIGH';
  }

  // Simple prompt injection detection
  if (
    /ignore\s+(all\s+)?previous\s+instructions|disregard\s+your\s+system\s+prompt/i.test(
      text
    )
  ) {
    violations.push('DIRECT_PROMPT_INJECTION');
    riskLevel = 'HIGH';
  }

  return {
    riskLevel,
    violations,
    reasoning:
      violations.length > 0
        ? `Local audit detected potential ${violations.join(', ')}`
        : 'No violations detected in local audit',
  };
}
