# @continum/sdk

> Governed Execution Framework for LLM Applications

**Current Version**: 0.1.0

**Latest Changes (v0.1.0)**:
- ✨ Runtime metadata enrichment for compliance tracking
- ✨ Batch operations for parallel LLM calls
- ✨ Smart retry with exponential backoff
- ✨ Provider fallback configuration
- ✨ Organization context support
- ✨ Enhanced error handling and resilience
- 🔧 Improved streaming utilities
- 📚 Comprehensive documentation updates

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

### Basic Usage

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

### Runtime Metadata Enrichment (NEW in v0.1.0)

Capture runtime context for compliance tracking:

```typescript
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Process this order' }],
  metadata: {
    userId: 'user_123',
    sessionId: 'sess_abc',
    applicationContext: 'checkout_flow',
    userRole: 'customer',
    ipAddress: req.ip,
    tags: ['ecommerce', 'payment'],
    customFields: {
      orderId: 'order_456',
      amount: 99.99,
      currency: 'USD'
    }
  }
});

// Metadata is automatically included in compliance signals
// View in dashboard: Evidence → Signals → Filter by metadata
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

### Organization Context (NEW in v0.1.0)

Configure organization-level features:

```typescript
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  organizationId: 'org_123',
  accountType: 'ORGANIZATION',
  apiKeys: { openai: process.env.OPENAI_API_KEY },
});

// Organization context is automatically included in all API calls
// Enables team-wide pattern sharing and compliance tracking
```

### Batch Operations (NEW in v0.1.0)

Process multiple LLM calls efficiently:

```typescript
// Execute multiple calls in parallel
const results = await continum.batchChat([
  {
    provider: 'openai',
    model: 'gpt_4o',
    params: {
      messages: [{ role: 'user', content: 'Analyze sentiment' }],
      metadata: { batchId: 'batch_1', index: 0 }
    }
  },
  {
    provider: 'anthropic',
    model: 'opus_4_6',
    params: {
      messages: [{ role: 'user', content: 'Extract entities' }],
      metadata: { batchId: 'batch_1', index: 1 }
    }
  },
  {
    provider: 'gemini',
    model: 'gemini_2_5_pro',
    params: {
      messages: [{ role: 'user', content: 'Summarize text' }],
      metadata: { batchId: 'batch_1', index: 2 }
    }
  }
]);

// All calls execute in parallel with Guardian protection
// All results are audited in background
console.log(`Processed ${results.length} calls`);
```

### Smart Retry with Fallback (NEW in v0.1.0)

Automatic retry and provider fallback:

```typescript
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY
  },
  retryConfig: {
    enabled: true,
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2
  },
  fallbackConfig: {
    enabled: true,
    fallbackOrder: [
      { provider: 'anthropic', model: 'opus_4_6' },
      { provider: 'openai', model: 'gpt_4o' }
    ]
  }
});

// Automatically retries on transient errors
// Falls back to alternative providers if primary fails
const response = await continum.smartChat('openai', 'gpt_4o', {
  messages: [{ role: 'user', content: 'Hello' }]
});

// Disable retry for specific calls
const response2 = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  skipRetry: true
});
```

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

// Skip retry for this call
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  skipRetry: true
});
```

## SDK-Exclusive Features

These features are only available in the SDK and cannot be done in the dashboard:

### 1. Runtime Metadata Enrichment

Capture application context at call-time:

```typescript
import { getCurrentUser, getSessionInfo } from './auth';

const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: prompt }],
  metadata: {
    userId: getCurrentUser().id,
    userRole: getCurrentUser().role,
    sessionId: getSessionInfo().sessionId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    applicationVersion: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
    customFields: {
      tenantId: getCurrentUser().tenantId,
      featureFlags: getActiveFeatureFlags(),
      requestId: req.id
    }
  }
});
```

### 2. CI/CD Integration

Automated compliance checks in pipelines:

```typescript
// In GitHub Actions, Jenkins, etc.
import { Continum } from '@continum/sdk';

const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: { openai: process.env.OPENAI_API_KEY }
});

// Run compliance test suite
const testResults = await continum.batchChat(
  testCases.map(test => ({
    provider: 'openai',
    model: 'gpt_4o',
    params: {
      messages: test.messages,
      metadata: { testId: test.id, pipeline: 'ci' }
    }
  }))
);

// Fail build if any violations detected
const violations = testResults.filter(r => r.violations?.length > 0);
if (violations.length > 0) {
  throw new Error(`${violations.length} compliance violations detected`);
}
```

### 3. Custom Application Logic

Embed compliance in business logic:

```typescript
async function processOrder(order: Order) {
  // Only use AI for high-value orders
  if (order.amount > 1000) {
    const response = await continum.llm.openai.gpt_4o.chat({
      messages: [{ role: 'user', content: `Analyze order ${order.id}` }],
      metadata: {
        orderId: order.id,
        amount: order.amount,
        customerId: order.customerId,
        riskLevel: order.amount > 10000 ? 'HIGH' : 'MEDIUM'
      }
    });
    
    // Custom incident handling
    if (response.violations?.length > 0) {
      await notifySecurityTeam(response.violations);
      await createIncident(order.id, response.violations);
    }
    
    return response;
  }
}
```

### 4. Multi-Provider Orchestration

Runtime provider selection and fallback:

```typescript
async function smartLLMCall(prompt: string, complexity: 'simple' | 'complex') {
  try {
    // Use cheaper model for simple tasks
    if (complexity === 'simple') {
      return await continum.llm.openai.gpt_4o_mini.chat({
        messages: [{ role: 'user', content: prompt }]
      });
    }
    
    // Use powerful model for complex tasks
    return await continum.llm.anthropic.opus_4_6.chat({
      messages: [{ role: 'user', content: prompt }]
    });
  } catch (error) {
    // Fallback to alternative provider
    console.warn('Primary provider failed, using fallback');
    return await continum.llm.gemini.gemini_2_5_pro.chat({
      messages: [{ role: 'user', content: prompt }]
    });
  }
}
```

### 5. Error Handling and Retry Logic

Programmatic control flow:

```typescript
async function robustLLMCall(prompt: string) {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      return await continum.llm.openai.gpt_4o.chat({
        messages: [{ role: 'user', content: prompt }]
      });
    } catch (error: any) {
      attempts++;
      
      if (error.message?.includes('Guardian blocked')) {
        // Custom handling for Guardian blocks
        const sanitized = await sanitizePrompt(prompt);
        prompt = sanitized;
      } else if (error.message?.includes('rate limit')) {
        // Exponential backoff
        await sleep(Math.pow(2, attempts) * 1000);
      } else {
        throw error;
      }
    }
  }
}
```

### 6. Batch Processing with Progress

Process large datasets efficiently:

```typescript
import { executeBatch } from '@continum/sdk/utils/batch';

const calls = documents.map(doc => ({
  provider: 'openai' as const,
  model: 'gpt_4o',
  params: {
    messages: [{ role: 'user', content: `Analyze: ${doc.content}` }],
    metadata: { documentId: doc.id }
  }
}));

const results = await executeBatch(
  calls,
  call => continum.llm[call.provider][call.model].chat(call.params),
  {
    concurrency: 5,
    onProgress: (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    }
  }
);

console.log(`Processed ${results.length} documents`);
console.log(`Success: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);
```

## Features

### Core Features
- **Zero Latency**: Users get responses instantly
- **Privacy First**: Your API keys never leave your server
- **Dual Protection**: Guardian blocks threats, Shadow Audit monitors
- **Comprehensive Detection**: PII, bias, security, prompt injection
- **Real-time Dashboard**: Monitor violations and compliance

### SDK-Exclusive Features (v0.1.0)
- **Runtime Metadata Enrichment**: Capture application context at call-time
- **Batch Operations**: Process multiple LLM calls in parallel
- **Smart Retry**: Automatic retry with exponential backoff
- **Provider Fallback**: Automatic failover to alternative providers
- **CI/CD Integration**: Automated compliance checks in pipelines
- **Custom Logic Integration**: Embed compliance in business workflows
- **Multi-Provider Orchestration**: Runtime provider selection
- **Error Handling**: Programmatic control flow and recovery
- **Organization Context**: Team-wide pattern sharing and tracking
- **Offline Mode**: Local pattern matching without API calls

### What Dashboard Does Better
- Visual data exploration and filtering
- Manual incident management workflows
- Team collaboration and approvals
- Configuration management UI
- Reporting and analytics dashboards
- Evidence package generation (manual)

### What SDK Does Better
- Runtime interception and protection
- Programmatic automation and orchestration
- CI/CD pipeline integration
- Custom application logic embedding
- Batch processing with concurrency control
- Real-time metadata enrichment
- Error handling and retry logic
- Provider fallback and routing

## Use Cases

### 1. E-commerce Platform
```typescript
// Protect customer data in AI-powered support
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: customerQuery }],
  metadata: {
    userId: customer.id,
    orderId: order.id,
    applicationContext: 'customer_support',
    tags: ['support', 'order_inquiry']
  }
});
```

### 2. Healthcare Application
```typescript
// HIPAA-compliant AI interactions
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: { openai: process.env.OPENAI_API_KEY },
  defaultSandbox: 'hipaa_compliance',
  guardianConfig: {
    action: 'BLOCK_ON_DETECT',
    customPatterns: [
      { name: 'MRN', pattern: /MRN[:\s]*\d{6,}/gi, riskLevel: 'HIGH' }
    ]
  }
});
```

### 3. Financial Services
```typescript
// Multi-provider with fallback for high availability
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY
  },
  fallbackConfig: {
    enabled: true,
    fallbackOrder: [
      { provider: 'anthropic', model: 'opus_4_6' },
      { provider: 'openai', model: 'gpt_4o' }
    ]
  }
});
```

### 4. CI/CD Compliance Testing
```typescript
// Automated compliance checks in GitHub Actions
const testResults = await continum.batchChat(
  complianceTests.map(test => ({
    provider: 'openai',
    model: 'gpt_4o',
    params: {
      messages: test.messages,
      metadata: { testId: test.id, pipeline: 'ci' }
    }
  }))
);

if (testResults.some(r => r.violations?.length > 0)) {
  process.exit(1); // Fail build
}
```

## Configuration Reference

### ContinumConfig

```typescript
interface ContinumConfig {
  // Required
  continumKey: string;
  
  // API Keys (provide only what you need)
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  
  // Organization context
  organizationId?: string;
  accountType?: 'INDIVIDUAL' | 'ORGANIZATION';
  
  // Default sandbox
  defaultSandbox?: string;
  
  // Guardian configuration
  guardianConfig?: {
    enabled?: boolean;
    action?: 'BLOCK_ON_DETECT' | 'REDACT_AND_CONTINUE' | 'ALLOW_ALL';
    localOnly?: boolean;
    customPatterns?: Array<{
      name: string;
      pattern: RegExp;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };
  
  // Detonation configuration
  detonationConfig?: {
    enabled?: boolean;
  };
  
  // Retry configuration
  retryConfig?: {
    enabled?: boolean;
    maxAttempts?: number;
    backoffMultiplier?: number;
    initialDelayMs?: number;
  };
  
  // Fallback configuration
  fallbackConfig?: {
    enabled?: boolean;
    fallbackOrder?: Array<{
      provider: 'openai' | 'anthropic' | 'gemini';
      model: string;
    }>;
  };
  
  // Strict mode
  strictMirror?: boolean;
}
```

### CallOptions

```typescript
interface CallOptions {
  // Required
  messages: Message[];
  
  // Optional LLM parameters
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  reasoning_effort?: 'low' | 'medium' | 'high';
  
  // Continum-specific options
  sandbox?: string;
  skipGuardian?: boolean;
  skipDetonation?: boolean;
  skipRetry?: boolean;
  
  // Runtime metadata
  metadata?: {
    userId?: string;
    sessionId?: string;
    applicationContext?: string;
    userRole?: string;
    ipAddress?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  };
}
```

## API Reference

### Main SDK Class

#### `new Continum(config: ContinumConfig)`
Create a new Continum SDK instance.

#### `continum.llm.{provider}.{model}.chat(params: CallOptions): Promise<ChatResult>`
Execute an LLM call with Guardian protection and Shadow Audit.

#### `continum.batchChat(calls: BatchCallConfig[]): Promise<ChatResult[]>`
Execute multiple LLM calls in parallel.

#### `continum.smartChat(provider, model, params): Promise<ChatResult>`
Execute an LLM call with automatic retry and fallback.

#### `continum.scanPrompt(prompt, options?): Promise<GuardianResult>`
Manually scan a prompt for PII before sending to LLM.

#### `continum.shadowAudit(sandbox, triplet): void`
Manually trigger a shadow audit (fire-and-forget).

### Utility Functions

#### `executeBatch(calls, executor, options): Promise<BatchResult[]>`
Execute batch calls with concurrency control and progress tracking.

#### `retryWithBackoff(fn, options): Promise<T>`
Retry a function with exponential backoff.

### Types

See [Type Definitions](./src/types/index.ts) for complete type reference.

## Environment Variables

```bash
# Required
CONTINUM_KEY=your_continum_key

# Provider API Keys (provide only what you need)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key

# Optional: Enable debug logging
CONTINUM_DEBUG=true
```

## Migration Guide

### From v0.0.5 to v0.1.0

No breaking changes! All new features are opt-in.

**New features you can adopt:**

1. **Runtime Metadata**:
```typescript
// Before
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello' }]
});

// After (optional)
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  metadata: { userId: 'user_123', sessionId: 'sess_abc' }
});
```

2. **Batch Operations**:
```typescript
// Before
const results = await Promise.all([
  continum.llm.openai.gpt_4o.chat({...}),
  continum.llm.anthropic.opus_4_6.chat({...})
]);

// After (better)
const results = await continum.batchChat([
  { provider: 'openai', model: 'gpt_4o', params: {...} },
  { provider: 'anthropic', model: 'opus_4_6', params: {...} }
]);
```

3. **Smart Retry**:
```typescript
// Before
let result;
for (let i = 0; i < 3; i++) {
  try {
    result = await continum.llm.openai.gpt_4o.chat({...});
    break;
  } catch (error) {
    if (i === 2) throw error;
    await sleep(1000 * Math.pow(2, i));
  }
}

// After (automatic)
const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: { openai: process.env.OPENAI_API_KEY },
  retryConfig: { enabled: true, maxAttempts: 3 }
});

const result = await continum.llm.openai.gpt_4o.chat({...});
// Retries automatically!
```

## Documentation

- [Setup Guide](https://docs.continum.co/setup)
- [API Reference](https://docs.continum.co/api)
- [Examples](https://docs.continum.co/examples)

## Support

- [GitHub Issues](https://github.com/Continum-Agency/continum-sdk/issues)
- [Documentation](https://docs.continum.co)
- Email: support@continum.co 
