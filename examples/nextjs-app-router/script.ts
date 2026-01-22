import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { createTraceMemTools } from '@tracemem/vercel-ai';

async function run() {
    const result = await generateText({
        model: openai('gpt-5.2-codex'),
        prompt: 'Refactor the current directory structure.',
        tools: createTraceMemTools({
            apiKey: process.env.TRACEMEM_API_KEY,
        })
    });

    console.log(result.text);
}

run().catch(console.error);
