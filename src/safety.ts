const OBVIOUS_SENSITIVE_TERM_REGEX = /token|secret|password|api_key|apikey|auth|credential/i;

/**
 * A thin additional redaction layer to catch obvious secrets in tool inputs/outputs
 * before they reach the TraceMem SDK or Vercel context.
 * 
 * Note: TraceMem SDK has its own robust sanitizer. This is just a safety net for
 * keys explicitly labeled as secrets.
 */
export function redactObviousSecrets(data: any): any {
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(redactObviousSecrets);
    }

    const result: any = {};
    for (const key of Object.keys(data)) {
        if (OBVIOUS_SENSITIVE_TERM_REGEX.test(key)) {
            result[key] = '[REDACTED]';
        } else {
            result[key] = redactObviousSecrets(data[key]);
        }
    }
    return result;
}
