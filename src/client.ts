import { TraceMemClient, TraceMemClientOptions } from '@tracemem/ts-sdk';

export type CreateTraceMemClientOptions = Omit<TraceMemClientOptions, 'apiKey'> & {
    apiKey?: string;
};

export function createTraceMemClient(options: CreateTraceMemClientOptions = {}): TraceMemClient {
    const apiKey = options.apiKey || process.env.TRACEMEM_API_KEY;

    if (!apiKey) {
        throw new Error(
            'TraceMem API Key is required. Please set TRACEMEM_API_KEY environment variable or pass apiKey in options.'
        );
    }

    return new TraceMemClient({
        ...options,
        apiKey,
    });
}
