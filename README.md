# @continum/sdk

Zero-latency compliance auditing for LLM applications. Wrap any LLM call with `protect()` and every interaction is automatically audited for PII, security, bias, and regulatory compliance.

## Installation

```bash
npm install @continum/sdk
```

## Quick Start

```typescript
import { protect } from '@continum/sdk';
import OpenAI from 'openai';

const openai = new OpenAI();

const response = await protect(
  () => openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: userMessage }],
  }),
  {
    apiKey: process.env.CONTINUM_API_KEY!,
    preset: 'customer-support',
  }
);
```

That's it. Every LLM call is now audited. Sandboxes are created automatically based on your preset.

## Global Configuration

```typescript
import { continum } from '@continum/sdk';

continum.configure({
  apiKey: process.env.CONTINUM_API_KEY!,
  preset: 'customer-support',
  comply: ['GDPR', 'SOC2'],
});

// Then use anywhere
const response = await continum.protect(
  () => openai.chat.completions.create({...})
);
```

## Presets

| Preset | Detection Types |
|--------|----------------|
| `customer-support` | PII, content policy, bias |
| `legal-ai` | PII, legal compliance, hallucination, bias |
| `fintech-ai` | PII, financial compliance, security, bias |
| `healthcare-ai` | PII, content policy, bias, hallucination |
| `coding-assistant` | Security, supply chain, prompt injection |
| `agent` | Agent safety, prompt injection, data exfiltration |
| `content-generation` | Content policy, bias, hallucination |
| `data-pipeline` | PII, data exfiltration, security |

## Compliance Frameworks

```typescript
const response = await protect(fn, {
  apiKey: process.env.CONTINUM_API_KEY!,
  comply: ['GDPR', 'HIPAA', 'SOC2'],
});
```

Supported: `GDPR`, `CCPA`, `HIPAA`, `SOC2`, `ISO_27001`, `EU_AI_ACT`, `FINRA`, `FCA`, `PCI_DSS`, `PDPA`, `PIPEDA`, `UK_DPA_2018`, `NIST_AI_RMF`

## Blocking Mode

Block LLM responses that exceed a risk threshold:

```typescript
const response = await protect(fn, {
  apiKey: process.env.CONTINUM_API_KEY!,
  preset: 'customer-support',
  blockOn: 'HIGH', // Throws ContinumBlockedError if risk >= HIGH
});
```

## Violation Handlers

```typescript
const response = await protect(fn, {
  apiKey: process.env.CONTINUM_API_KEY!,
  preset: 'customer-support',
  onViolation: {
    PII_LEAK: (signal) => {
      console.warn('PII detected:', signal.reasoning);
    },
  },
  onRiskLevel: {
    CRITICAL: (signal) => {
      alertSecurityTeam(signal);
    },
  },
});
```

## Supported LLM Providers

- **OpenAI** — `openai` package
- **Anthropic** — `@anthropic-ai/sdk` package  
- **Google Gemini** — `@google/generative-ai` package
- **AWS Bedrock** — via bedrock-runtime endpoint
- **Azure OpenAI** — via api.azure.com endpoint

The SDK intercepts at the HTTP transport layer, so it works with any client that uses Node.js `https.request` under the hood.

## Environment Variables

```env
CONTINUM_API_KEY=ctn_live_your_workspace_id_your_key
CONTINUM_DEBUG=true  # Optional: verbose logging
```

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.x (if using TypeScript)
