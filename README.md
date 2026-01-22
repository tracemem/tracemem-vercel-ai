# @tracemem/vercel-ai

TraceMem integration for Vercel AI SDK.
Seamlessly add TraceMem's decision memory and MCP capabilities to your Vercel AI agents.

## Quickstart

1. Install:
```bash
npm install @tracemem/vercel-ai @tracemem/ts-sdk zod
```

2. Generate Tools:
```typescript
import { createTraceMemTools } from '@tracemem/vercel-ai';

const tools = createTraceMemTools({
  apiKey: process.env.TRACEMEM_API_KEY,
  // Optional: Add context to every tool call
  context: ({ tool }) => ({
    route: '/api/chat',
    metadata: { source: 'vercel-ai-sdk' }
  })
});
```

3. Use in Vercel AI SDK (Next.js App Router):
```typescript
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { createTraceMemTools } from '@tracemem/vercel-ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-5.2-codex'),
    messages,
    system: `
      You are a helpful assistant. 
      Use the 'tracememOpen' tool to start a tracked decision context if dealing with complex tasks.
      Always capture the returned 'decisionId' and pass it to subsequent tools (note, read, write, close).
    `,
    tools: createTraceMemTools({
      apiKey: process.env.TRACEMEM_API_KEY,
      defaults: { automationMode: 'propose' }
    }),
  });

  return result.toDataStreamResponse();
}
```

## Tools Provided

The library exports a set of tools mapped to the TraceMem SDK. By default, they are named:
- `tracememOpen(action, intent?)` -> Returns `{ decisionId }`
- `tracememNote(decisionId, message, kind?)`
- `tracememRead(decisionId, product, purpose, query?)`
- `tracememEvaluate(decisionId, policy, inputs)`
- `tracememRequestApproval(decisionId, message)`
- `tracememWrite(decisionId, product, purpose, mutation)`
- `tracememClose(decisionId, outcome)`
- ...and more.

## Context Injection

You can inject metadata into every TraceMem interaction using a context provider:

```typescript
const tools = createTraceMemTools({
  apiKey: process.env.KEY,
  context: async ({ tool, args }) => {
    // Return context object to be merged into metadata
    return {
      userId: 'user_123',
      requestId: 'req_abc'
    };
  }
});
```

## Security & Redaction

This library automatically attempts to redact sensitive keys (like `token`, `password`, `secret`) from tool inputs before passing them to TraceMem or logging them in context.
However, you must ensure that your agent prompts do not encourage leaking secrets into non-redacted fields.

## License

Apache License 2.0
