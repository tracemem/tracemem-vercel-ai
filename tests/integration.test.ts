import { createTraceMemClient } from '../src/client';
import { createTraceMemTools } from '../src/tools';

const apiKey = process.env.TRACEMEM_API_KEY_TEST;
const describeIf = apiKey ? describe : describe.skip;

describeIf('Integration', () => {
    let client: ReturnType<typeof createTraceMemClient>;

    beforeAll(() => {
        if (!apiKey) throw new Error('API Key missing in integration test');
        client = createTraceMemClient({ apiKey });
    });

    it('can open and close a decision', async () => {
        const handle = await client.open('test_action');
        expect(handle.decisionId).toBeDefined();
        await client.close(handle.decisionId, { outcome: 'abort' });
    });

    it('tools object structure is correct', () => {
        const tools = createTraceMemTools({ client });
        expect(tools.tracememOpen).toBeDefined();
        expect(tools.tracememNote).toBeDefined();
        expect(tools.tracememOpen.parameters).toBeDefined();
    });
});
