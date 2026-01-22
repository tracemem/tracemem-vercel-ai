export interface TraceMemVercelContext {
    requestId?: string;
    route?: string;
    userId?: string;
    sessionId?: string;
    tenantId?: string;
    tags?: string[];
    externalRefs?: Record<string, any>;
    metadata?: Record<string, any>;
    [key: string]: any;
}

export type TraceMemVercelContextProvider = (input: {
    tool: string;
    args: any;
    runtime?: "nodejs" | "edge";
}) => TraceMemVercelContext | Promise<TraceMemVercelContext>;

export function mergeContexts(
    ...contexts: (TraceMemVercelContext | undefined)[]
): TraceMemVercelContext {
    return contexts.reduce((acc, ctx) => {
        if (!ctx) return acc;
        const { tags, externalRefs, metadata, ...rest } = ctx;

        return {
            ...acc,
            ...rest,
            tags: [...(acc?.tags || []), ...(tags || [])],
            externalRefs: { ...(acc?.externalRefs || {}), ...(externalRefs || {}) },
            metadata: { ...(acc?.metadata || {}), ...(metadata || {}) },
        };
    }, {}) || {};
}
