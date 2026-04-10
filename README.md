# @continum/sdk v0.6.0

**Protection-first AI compliance in one line**

Zero-latency compliance auditing for every LLM call in your application. Wrap any LLM call with `protect()` and get automatic PII detection, bias monitoring, security auditing, and compliance reporting.

## Installation

```bash
npm install @continum/sdk
```

## Quick Start

```typescript
import { protect } from '@continum/sdk';
import OpenAI from 'openai';

const openai = new OpenAI();

// Wrap your LLM call with protect()
const response = await protect(
  () => openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  }),
  {
    apiKey: process.env.CONTINUM_API_KEY!,
    preset: 'customer-support'
  }
);

// Use the response normally
console.log(response.choices[0].message.content);
```

That's it. Every LLM call is now audited for compliance violations with zero latency impact.

## Features

- **Zero Latency**: Fire-and-forget auditing doesn't slow down your application
- **Auto-Configuration**: Presets automatically configure the right detection types
- **Framework Compliance**: Specify `comply: ['GDPR', 'SOC2']` and get the right checks
- **Local Dev Mode**: Automatic local auditing in development without API calls
- **Blocking Mode**: Optional synchronous auditing when safety > speed
- **Violation Handlers**: React to specific violations in real-time

## Configuration

### Global Configuration

```typescript
import { continum } from '@continum/sdk';

continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  preset: 'customer-support',
  comply: ['GDPR', 'SOC2'],
  environment: 'production'
});

// Now use protect() without passing config every time
const response = await continum.protect(
  () => openai.chat.completions.create({...})
);
```

### Per-Call Configuration

```typescript
const response = await protect(
  () => openai.chat.completions.create({...}),
  {
    apiKey: process.env.CONTINUM_API_KEY!,
    preset: 'fintech-ai',
    comply: ['FINRA', 'SOC2'],
    userId: 'user_123',
    sessionId: 'session_456',
    metadata: { feature: 'chat' }
  }
);
```

## Presets

Presets automatically configure the right detection types for your use case:

- `customer-support` — PII detection, content policy, bias detection
- `legal-ai` — PII, legal compliance, hallucination detection, bias
- `fintech-ai` — PII, financial compliance, security audit, bias
- `healthcare-ai` — PII, content policy, bias, hallucination detection
- `coding-assistant` — Security audit, supply chain integrity, prompt injection
- `agent` — Agent safety, prompt injection, data exfiltration, security
- `content-generation` — Content policy, bias, hallucination detection
- `internal-tool` — PII detection, security audit
- `data-pipeline` — PII, data exfiltration, security audit
- `education-ai` — Content policy, bias, hallucination detection

## Compliance Frameworks

Specify compliance frameworks and get automatic detection configuration:

```typescript
continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  comply: ['GDPR', 'HIPAA', 'SOC2']
});
```

Supported frameworks:
- `GDPR`, `CCPA`, `HIPAA`, `SOC2`, `ISO_27001`
- `EU_AI_ACT`, `FINRA`, `FCA`, `PCI_DSS`
- `PDPA`, `PIPEDA`, `UK_DPA_2018`, `NIST_AI_RMF`

## Blocking Mode

By default, `protect()` uses fire-and-forget auditing (zero latency). For high-risk scenarios, use blocking mode:

```typescript
const response = await protect(
  () => openai.chat.completions.create({...}),
  {
    apiKey: process.env.CONTINUM_API_KEY!,
    blockOn: 'HIGH' // Block if risk level is HIGH or CRITICAL
  }
);
```

This will throw `ContinumBlockedError` if a violation is detected:

```typescript
import { protect, ContinumBlockedError } from '@continum/sdk';

try {
  const response = await protect(
    () => openai.chat.completions.create({...}),
    { apiKey: '...', blockOn: 'HIGH' }
  );
} catch (error) {
  if (error instanceof ContinumBlockedError) {
    console.log('Blocked:', error.signal.violations);
    console.log('Risk level:', error.signal.riskLevel);
    console.log('Reasoning:', error.signal.reasoning);
  }
}
```

## Violation Handlers

React to specific violations in real-time:

```typescript
continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  onViolation: {
    PII_LEAK: async (signal) => {
      await sendAlert('PII detected', signal);
    },
    PROMPT_INJECTION: async (signal) => {
      await logSecurityIncident(signal);
    }
  },
  onRiskLevel: {
    CRITICAL: async (signal) => {
      await notifySecurityTeam(signal);
    }
  }
});
```

## Local Development Mode

In development, Continum automatically runs local audits without calling the API:

```typescript
// Automatically enabled when NODE_ENV=development
const response = await protect(
  () => openai.chat.completions.create({...}),
  { apiKey: '...', preset: 'customer-support' }
);

// Output:
// [CONTINUM] ✓ audit:clean — LOW — gpt-4 — 45ms
```

Force local mode:

```typescript
continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  local: true
});
```

## Multi-Turn Conversations

Track conversations across multiple turns:

```typescript
const sessionId = 'session_' + Date.now();

for (const userMessage of conversation) {
  const response = await protect(
    () => openai.chat.completions.create({
      model: 'gpt-4',
      messages: [...history, { role: 'user', content: userMessage }]
    }),
    {
      apiKey: process.env.CONTINUM_API_KEY!,
      sessionId,
      userId: 'user_123'
    }
  );

  history.push({ role: 'assistant', content: response.choices[0].message.content });
}
```

## Supported Providers

`protect()` automatically detects and audits calls to:

- OpenAI (GPT-4, GPT-4o, o1, o3)
- Anthropic (Claude Opus, Sonnet, Haiku)
- Google (Gemini Pro, Gemini Flash)
- Azure OpenAI
- AWS Bedrock

## Advanced Configuration

### Direct Sandbox Configuration

For power users who want full control:

```typescript
continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  sandbox: {
    types: ['PII_DETECTION', 'SECURITY_AUDIT', 'PROMPT_INJECTION'],
    frameworks: ['GDPR', 'SOC2'],
    customRules: ['CUSTOM_RULE_1'],
    region: 'eu-west-1',
    blockOn: 'HIGH'
  }
});
```

### Error Handling

```typescript
continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  onError: (error) => {
    console.error('Audit error:', error);
    // Never throws — audit failures don't break your app
  }
});
```

### Alerts

Receive compliance violation alerts directly in Slack, PagerDuty, Discord, or custom webhooks without visiting the dashboard:

```typescript
continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  alerts: {
    slack: process.env.SLACK_WEBHOOK_URL,
    pagerduty: process.env.PAGERDUTY_KEY,
    discord: process.env.DISCORD_WEBHOOK_URL,
    webhook: process.env.CUSTOM_WEBHOOK_URL
  }
});
```

Alerts are automatically routed by risk level:
- **CRITICAL** violations → PagerDuty (if configured)
- **HIGH/CRITICAL** violations → Slack (if configured)
- **MEDIUM/LOW** violations → Discord (if configured)
- **All violations** → Custom webhook (if configured)

For detailed alert configuration, see the [Alert Setup Guide](../../docs/alert-setup-guide.md).

## Migration from v1

If you're using the old SDK:

```typescript
// Old (v1)
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY,
  apiKeys: { openai: process.env.OPENAI_API_KEY }
});

const response = await continum.llm.openai.gpt_4.chat({
  messages: [...]
});
```

```typescript
// New (v2)
import { protect } from '@continum/sdk';
import OpenAI from 'openai';

const openai = new OpenAI();

const response = await protect(
  () => openai.chat.completions.create({
    model: 'gpt-4',
    messages: [...]
  }),
  {
    apiKey: process.env.CONTINUM_API_KEY!,
    preset: 'customer-support'
  }
);
```

Benefits of v2:
- Use official provider SDKs directly
- Zero-latency by default
- Automatic sandbox resolution
- Preset-based configuration
- Local dev mode

## TypeScript Support

Full TypeScript support with comprehensive types:

```typescript
import type {
  RiskLevel,
  ViolationCode,
  ComplianceFramework,
  Preset,
  AuditSignal
} from '@continum/sdk';
```

## License

MIT

## Support

- Documentation: https://docs.continum.co
- Dashboard: https://app.continum.co
- Email: support@continum.co
