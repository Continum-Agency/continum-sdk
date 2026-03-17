# @continum/sdk

> Zero-latency compliance auditing for every LLM call in your application

## Quick Start

```bash
npm install @continum/sdk
```

```typescript
import { Continum } from '@continum/sdk';

const continum = new Continum({
  continumKey: process.env.CONTINUM_KEY!,
  apiKeys: {
    openai: process.env.OPENAI_API_KEY
  },
  defaultSandbox: 'pii_protection'
});

// Make LLM calls with automatic compliance
const response = await continum.llm.openai.gpt_4o.chat({
  messages: [{ role: 'user', content: 'Hello world' }]
});
// ✅ User gets response instantly
// ✅ Compliance audit runs in background
```

## Features

- **Zero Latency**: Users get responses instantly
- **Privacy First**: Your API keys never leave your server
- **Comprehensive Detection**: PII, bias, security, prompt injection
- **Real-time Dashboard**: Monitor violations and compliance

## Documentation

- [Setup Guide](https://docs.continum.io/setup)
- [API Reference](https://docs.continum.io/api)
- [Examples](https://docs.continum.io/examples)

## Support

- [GitHub Issues](https://github.com/Continum-Agency/continum-sdk/issues)
- [Documentation](https://docs.continum.io)
- Email: support@continum.io