import { redactObviousSecrets } from '../src/safety';
import { mergeContexts } from '../src/context';

describe('Safety', () => {
    it('redacts obvious secrets in flat object', () => {
        const input = { token: '123', safe: 'value', mySecret: 'abc' };
        expect(redactObviousSecrets(input)).toEqual({
            token: '[REDACTED]',
            safe: 'value',
            mySecret: '[REDACTED]'
        });
    });

    it('redacts nested secrets', () => {
        const input = { config: { apiKey: 'xyz' }, list: [{ password: '123' }] };
        expect(redactObviousSecrets(input)).toEqual({
            config: { apiKey: '[REDACTED]' },
            list: [{ password: '[REDACTED]' }]
        });
    });

    it('leaves non-sensitive data alone', () => {
        const input = { name: 'test', age: 10 };
        expect(redactObviousSecrets(input)).toEqual(input);
    });
});

describe('Context', () => {
    it('merges contexts correctly', () => {
        const c1 = { tags: ['a'], metadata: { key: 1 } };
        const c2 = { tags: ['b'], metadata: { foo: 'bar' }, userId: 'u1' };

        const merged = mergeContexts(c1, c2);
        expect(merged.tags).toEqual(['a', 'b']);
        expect(merged.metadata).toEqual({ key: 1, foo: 'bar' });
        expect(merged.userId).toEqual('u1');
    });

    it('handles undefined inputs', () => {
        const merged = mergeContexts(undefined, { tags: ['a'] });
        expect(merged.tags).toEqual(['a']);
    });
});
