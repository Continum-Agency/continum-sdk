# @continum/sdk

> Governed Execution Framework for LLM Applications

**Current Version**: 0.0.5

**Latest Changes**:
- Fixed `max_tokens` validation for Anthropic thinking models
- Thinking budget set to 1000 tokens for better cost efficiency
- SDK automatically adjusts `max_tokens` if too low (minimum 3048)
- Improved handling of token limits for thinking models

## Quick Start

### Installation

```bash
# Install the Continum SDK
npm install @continum/sdk

# Install LLM providers you plan to use (choose one or more)
npm install openai                    # For OpenAI GPT models
npm install @anthropic-ai/sdk         # For Claude models  
npm install @google/generative-ai     # For Gemini models
```

### Usage

```typescript
import { Continum } from '@continum/sdk';

const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY
  },
  defaultSandbox: 'pii_protection'
});

// OpenAI - use snake_case model names
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello world' }]
});

// Anthropic - use model family names (opus, sonnet, haiku)
const response2 = await continum.llm.anthropic.opus_4_6.chat({
  messages: [{ role: 'user', content: 'Review this code' }]
});
// Also supports: sonnet_4_6, sonnet_4, haiku_4_5, haiku_3_5, sonnet_3_7
// Legacy format also works: claude_3_5_sonnet

// Gemini - use snake_case with underscores
const response3 = await continum.llm.gemini.gemini_2_5_pro.chat({
  messages: [{ role: 'user', content: 'Summarize this' }]
});

// ✅ Guardian checks for PII (pre-execution)
// ✅ User gets response instantly
// ✅ Shadow Audit runs in background (post-execution)
```

## Model Name Format

The SDK uses snake_case model names that get automatically transformed to the correct API format:

### Anthropic Models

```typescript
// Recommended format - use model family names
continum.llm.anthropic.opus_4_6.chat()      // → claude-opus-4-6
continum.llm.anthropic.sonnet_4_6.chat()    // → claude-sonnet-4-6
continum.llm.anthropic.sonnet_4.chat()      // → claude-sonnet-4-5
continum.llm.anthropic.haiku_4_5.chat()     // → claude-haiku-4-5-20251001
continum.llm.anthropic.haiku_3_5.chat()     // → claude-haiku-3-5-20241022
continum.llm.anthropic.sonnet_3_7.chat()    // → claude-sonnet-3-7-20250219

// Legacy format also supported (v0.0.4+)
continum.llm.anthropic.claude_3_5_sonnet.chat()  // → claude-3-5-sonnet-20241022

// Alias: claude and anthropic are interchangeable
continum.llm.claude.opus_4_6.chat()  // Same as anthropic.opus_4_6
```

### OpenAI Models

```typescript
continum.llm.openai.gpt_5.chat()       // → gpt-5
continum.llm.openai.gpt_4o.chat()      // → gpt-4o
continum.llm.openai.gpt_4_turbo.chat() // → gpt-4-turbo
continum.llm.openai.o3.chat()          // → o3
continum.llm.openai.o3_mini.chat()     // → o3-mini
continum.llm.openai.o1.chat()          // → o1
```

### Gemini Models

```typescript
continum.llm.gemini.gemini_2_5_pro.chat()   // → gemini-2.5-pro
continum.llm.gemini.gemini_2_5_flash.chat() // → gemini-2.5-flash
continum.llm.gemini.gemini_2_0_flash.chat() // → gemini-2.0-flash
continum.llm.gemini.gemini_1_5_pro.chat()   // → gemini-1.5-pro
```

## Architecture

### Two-Tier Protection System

**Guardian (Pre-Execution)**
- Blocks or redacts threats BEFORE they reach the LLM
- < 100ms latency with local pattern matching
- Protects against: Prompt Injection, Data Exfiltration, PII leakage
- Action: BLOCK (high risk) or REDACT (medium risk)

**Shadow Audit (Post-Execution)**
- Monitors and logs AFTER LLM responds
- Zero user-facing latency (fire-and-forget)
- Detects: Bias, Hallucinations, Compliance violations, Security issues
- Action: LOG and ALERT (never blocks users)

### Sandbox Types

#### Guardian Sandboxes (Pre-Execution)
- `PROMPT_INJECTION` - Detect and block prompt injection attacks
- `DATA_EXFILTRATION` - Prevent sensitive data leakage
- `PII_DETECTION` - Identify and redact personal information
- `CONTENT_POLICY` - Enforce content guidelines

#### Shadow Audit Sandboxes (Post-Execution)
- `BIAS_DETECTION` - Monitor for biased outputs
- `SECURITY_AUDIT` - Audit security compliance
- `REGULATORY_COMPLIANCE` - Track regulatory adherence
- `AGENT_SAFETY` - Monitor agent behavior
- `HALLUCINATION_DETECTION` - Detect factual inaccuracies
- `FINANCIAL_COMPLIANCE` - Ensure financial regulations
- `LEGAL_COMPLIANCE` - Monitor legal compliance
- `MULTI_TURN_ATTACK` - Detect multi-step attacks
- `SUPPLY_CHAIN_INTEGRITY` - Verify supply chain security
- `FULL_SPECTRUM` - Comprehensive monitoring
- `CUSTOM` - Custom audit rules

## Advanced Configuration

### Guardian Configuration

```typescript
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: { openai: process.env.OPENAI_API_KEY },
  guardianConfig: {
    enabled: true,              // Enable pre-LLM protection
    action: 'REDACT_AND_CONTINUE', // Guardian action mode
    // Options: 'BLOCK_ON_DETECT', 'REDACT_AND_CONTINUE', 'ALLOW_ALL'
    localOnly: false,           // Use remote ML for complex cases
    customPatterns: [
      {
        name: 'INTERNAL_ID',
        pattern: /EMP-\d{6}/g,
        riskLevel: 'HIGH'
      }
    ]
  }
});
```

#### Guardian Action Modes

- **BLOCK_ON_DETECT**: Block request immediately if any PII is detected
- **REDACT_AND_CONTINUE**: Redact PII and continue with LLM call (default)
- **ALLOW_ALL**: Disable Guardian protection (allow everything)

### Shadow Audit Configuration

```typescript
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: { openai: process.env.OPENAI_API_KEY },
  detonationConfig: {
    enabled: true  // Enable shadow auditing
  },
  strictMirror: false  // Never block users on audit failures
});
```

### Per-Call Overrides

```typescript
// Skip Guardian for this specific call
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  skipGuardian: true
});

// Skip Shadow Audit for this specific call
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  skipDetonation: true
});

// Use a different sandbox for this call
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  sandbox: 'strict_pii_detection'
});
```

## Features

- **Zero Latency**: Users get responses instantly
- **Privacy First**: Your API keys never leave your server
- **Dual Protection**: Guardian blocks threats, Shadow Audit monitors
- **Comprehensive Detection**: PII, bias, security, prompt injection
- **Real-time Dashboard**: Monitor violations and compliance

## Documentation

- [Setup Guide](https://docs.continum.co/setup)
- [API Reference](https://docs.continum.co/api)
- [Examples](https://docs.continum.co/examples)

## Support

- [GitHub Issues](https://github.com/Continum-Agency/continum-sdk/issues)
- [Documentation](https://docs.continum.co)
- Email: support@continum.co 
