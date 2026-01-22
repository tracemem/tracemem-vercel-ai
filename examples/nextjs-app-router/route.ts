import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { createTraceMemTools } from '@tracemem/vercel-ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages } = await req.json();

    const result = await streamText({
        model: openai('gpt-5.2-codex'),
        messages,
        system: `
      You are an intelligent agent integrated with TraceMem.
      
      1. When you start a task, call 'tracememOpen' to get a decisionId.
      2. Use 'tracememNote' to record your thoughts.
      3. Use 'tracememRead' to fetch context.
      4. Use 'tracememEvaluate' to check policies.
      5. Use 'tracememWrite' to make changes (if allowed).
      6. Use 'tracememClose' when finished (outcome='commit' or 'abort').
      
      Always pass the 'decisionId' to tools that require it.
    `,
        tools: createTraceMemTools({
            apiKey: process.env.TRACEMEM_API_KEY,
            defaults: {
                automationMode: 'propose'
            },
            context: async ({ tool }) => ({
                route: '/api/chat',
                userId: 'demo-user'
            })
        }),
    });

    return result.toTextStreamResponse();
}
