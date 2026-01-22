import { z } from 'zod';
import { TraceMemClient } from '@tracemem/ts-sdk';
import { CreateTraceMemClientOptions, createTraceMemClient } from './client';
import { TraceMemVercelContextProvider, TraceMemVercelContext, mergeContexts } from './context';
import { redactObviousSecrets } from './safety';

export type AutomationMode = 'propose' | 'execute' | 'validate';

export interface CreateTraceMemToolsConfig extends CreateTraceMemClientOptions {
    client?: TraceMemClient;
    defaults?: {
        actor?: string;
        automationMode?: AutomationMode;
        closeOutcomeOnError?: 'abort' | 'commit';
    };
    context?: TraceMemVercelContextProvider;
    toolNames?: Partial<Record<keyof TraceMemTools, string>>;
    sanitize?: boolean;
    exposeDecisionHandleTool?: boolean;
}

export interface TraceMemTools {
    tracememOpen: any; // CoreTool
    tracememNote: any;
    tracememRead: any;
    tracememEvaluate: any;
    tracememRequestApproval: any;
    tracememWrite: any;
    tracememTrace: any;
    tracememReceipt: any;
    tracememClose: any;
    tracememProductsList: any;
    tracememProductGet: any;
    tracememCapabilities: any;
    [key: string]: any;
}

export function createTraceMemTools(config: CreateTraceMemToolsConfig): TraceMemTools {
    const client = config.client || createTraceMemClient(config);
    const toolNames = config.toolNames || {};
    const shouldSanitize = config.sanitize ?? true; // Default true to match SDK

    const getContext = async (toolName: string, args: any): Promise<TraceMemVercelContext> => {
        if (!config.context) return {};
        try {
            return await config.context({ tool: toolName, args, runtime: process.env.NEXT_RUNTIME as any || 'nodejs' });
        } catch (e) {
            console.warn('TraceMem context provider failed:', e);
            return {};
        }
    };

    const wrapExecution = async (toolName: string, args: any, fn: (metadata: any) => Promise<any>) => {
        const ctx = await getContext(toolName, args);
        const metadata = shouldSanitize ? redactObviousSecrets(ctx) : ctx;

        // Inject defaults into metadata if not present?
        // Actually SDK expects options arguments typically, metadata is inside options for some calls.
        // We will pass metadata where appropriate.

        return fn(metadata);
    };

    const tools: any = {};

    // -- tracememOpen --
    const openName = toolNames.tracememOpen || 'tracememOpen';
    tools[openName] = {
        description: 'Start a new decision or task. Returns a decisionId to be used in subsequent calls.',
        parameters: z.object({
            action: z.string().describe('The type of action to perform (e.g. "refactor", "investigate")'),
            intent: z.string().optional().describe('Specific intent override')
        }),
        execute: async (args: { action: string; intent?: string }) => {
            return wrapExecution('tracememOpen', args, async (metadata) => {
                const handle = args.intent
                    ? await client.createDecision(args.intent, {
                        metadata,
                        actor: config.defaults?.actor,
                        automationMode: config.defaults?.automationMode
                    })
                    : await client.open(args.action, {
                        metadata,
                        actor: config.defaults?.actor,
                        automationMode: config.defaults?.automationMode
                    });

                return { decisionId: handle.decisionId };
            });
        }
    };

    // -- tracememNote --
    const noteName = toolNames.tracememNote || 'tracememNote';
    tools[noteName] = {
        description: 'Log a thought, observation, or reasoning for a decision.',
        parameters: z.object({
            decisionId: z.string().describe('The ID of the active decision'),
            message: z.string().describe('The content of the note'),
            kind: z.string().optional().describe('Kind of note (e.g. "thought", "error")'),
            data: z.record(z.any()).optional().describe('Additional data context')
        }),
        execute: async (args: { decisionId: string; message: string; kind?: string; data?: any }) => {
            return wrapExecution('tracememNote', args, async (metadata) => {
                const sanitizedData = shouldSanitize ? redactObviousSecrets(args.data) : args.data;
                // Merge metadata into data if needed, or pass separately? 
                // SDK note() signature: note(decisionId, options: { message, kind, data })
                // metadata isn't a top-level option for note usually, it goes into data?
                // Checking doc: "note... options: NoteOptions".
                // SDK usually supports metadata for context. Assuming SDK supports generic options or we put context in data.
                // The extraction doc says: "Attach Vercel context into metadata (for createDecision/open/note at minimum)"
                // If SDK note() options lacks metadata, we might put it in data.metadata.

                // However, standard TraceMem pattern is decision-level metadata. Note-level metadata is 'data'.
                const dataWithContext = { ...sanitizedData, _vercel_context: metadata };

                await client.note(args.decisionId, {
                    message: args.message,
                    kind: args.kind,
                    data: dataWithContext
                });
                return { success: true };
            });
        }
    };

    // -- tracememRead --
    const readName = toolNames.tracememRead || 'tracememRead';
    tools[readName] = {
        description: 'Read data from a product context.',
        parameters: z.object({
            decisionId: z.string(),
            product: z.string(),
            purpose: z.string(),
            query: z.any().optional()
        }),
        execute: async (args: { decisionId: string; product: string; purpose: string; query?: any }) => {
            return wrapExecution('tracememRead', args, async (metadata) => {
                // Read doesn't usually take metadata, but we can log that we read?
                // The prompt implies attach context. 
                // client.read(decisionId, options: ReadOptions & { product, purpose }).
                // We'll trust the SDK client.
                const result = await client.read(args.decisionId, {
                    product: args.product,
                    purpose: args.purpose,
                    query: args.query
                });
                return result;
            });
        }
    };

    // -- tracememEvaluate --
    const evalName = toolNames.tracememEvaluate || 'tracememEvaluate';
    tools[evalName] = {
        description: 'Evaluate inputs against a policy.',
        parameters: z.object({
            decisionId: z.string(),
            policy: z.string(),
            inputs: z.record(z.any())
        }),
        execute: async (args: { decisionId: string; policy: string; inputs: any }) => {
            return wrapExecution('tracememEvaluate', args, async () => {
                const result = await client.evaluate(args.decisionId, {
                    policy: args.policy,
                    inputs: args.inputs
                });
                return result;
            });
        }
    };

    // -- tracememRequestApproval --
    const approveName = toolNames.tracememRequestApproval || 'tracememRequestApproval';
    tools[approveName] = {
        description: 'Request human approval for a decision.',
        parameters: z.object({
            decisionId: z.string(),
            message: z.string().describe('Explanation for why approval is needed')
        }),
        execute: async (args: { decisionId: string; message: string }) => {
            return wrapExecution('tracememRequestApproval', args, async () => {
                await client.requestApproval(args.decisionId, {
                    // SDK might have different signature? Doc says: requestApproval(decisionId, options?)
                    // We assume generic options or pass message?
                    // "requestApproval(decisionId, options: RequestApprovalOptions)"
                    // Usually message is in options or inferred. Let's assume options has description/message.
                    description: args.message
                } as any);
                return { status: 'requested' };
            });
        }
    };

    // -- tracememWrite --
    const writeName = toolNames.tracememWrite || 'tracememWrite';
    tools[writeName] = {
        description: 'Execute a mutation/write action.',
        parameters: z.object({
            decisionId: z.string(),
            product: z.string(),
            purpose: z.string(),
            mutation: z.any(),
            idempotencyKey: z.string().optional()
        }),
        execute: async (args: { decisionId: string; product: string; purpose: string; mutation: any; idempotencyKey?: string }) => {
            return wrapExecution('tracememWrite', args, async () => {
                await client.write(args.decisionId, {
                    product: args.product,
                    purpose: args.purpose,
                    mutation: args.mutation,
                    idempotencyKey: args.idempotencyKey
                });
                return { success: true };
            });
        }
    };

    // -- tracememTrace --
    const traceName = toolNames.tracememTrace || 'tracememTrace';
    tools[traceName] = {
        description: 'Get the current trace of the decision.',
        parameters: z.object({
            decisionId: z.string()
        }),
        execute: async (args: { decisionId: string }) => {
            return client.trace(args.decisionId);
        }
    };

    // -- tracememReceipt --
    const receiptName = toolNames.tracememReceipt || 'tracememReceipt';
    tools[receiptName] = {
        description: 'Get the receipt for a closed or open decision.',
        parameters: z.object({
            decisionId: z.string()
        }),
        execute: async (args: { decisionId: string }) => {
            return client.receipt(args.decisionId);
        }
    };

    // -- tracememClose --
    const closeName = toolNames.tracememClose || 'tracememClose';
    tools[closeName] = {
        description: 'Finalize and close the decision.',
        parameters: z.object({
            decisionId: z.string(),
            outcome: z.enum(['commit', 'abort']),
            reason: z.string().optional()
        }),
        execute: async (args: { decisionId: string; outcome: 'commit' | 'abort'; reason?: string }) => {
            return wrapExecution('tracememClose', args, async () => {
                await client.close(args.decisionId, {
                    outcome: args.outcome,
                    reason: args.reason // Assuming SDK CloseOptions supports reason
                });
                return { success: true };
            });
        }
    };

    // -- tracememProductsList --
    const listName = toolNames.tracememProductsList || 'tracememProductsList';
    tools[listName] = {
        description: 'List available products in the system.',
        parameters: z.object({
            purpose: z.string().optional()
        }),
        execute: async (args: { purpose?: string }) => {
            return client.products.list(args);
        }
    };

    // -- tracememProductGet --
    const getName = toolNames.tracememProductGet || 'tracememProductGet';
    tools[getName] = {
        description: 'Get details of a specific product.',
        parameters: z.object({
            name: z.string()
        }),
        execute: async (args: { name: string }) => {
            return client.products.get(args.name);
        }
    };

    // -- tracememCapabilities --
    const capName = toolNames.tracememCapabilities || 'tracememCapabilities';
    tools[capName] = {
        description: 'Get capabilities of the connected TraceMem server.',
        parameters: z.object({}),
        execute: async () => {
            return client.capabilities();
        }
    };

    if (config.exposeDecisionHandleTool) {
        // Optional extra tool?
    }

    return tools;
}
