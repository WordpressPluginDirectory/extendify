// Net-new helper in the rebuild. Pins the contracts the cache guarantees for
// both source kinds (post + template-part):
//   1. In-flight Promises are shared across concurrent consumers (one
//      fetch for hover-prefetch + click).
//   2. post and template-part blocks number in separate spaces, so post #N
//      and header #N must not collide on the same cache key.
//   3. Failed Promises are evicted so the next consumer retries fresh.
//   4. invalidateBlockSource clears a specific entry post-save so a
//      re-edit mounts against the freshly rendered markup.

jest.mock('@wordpress/api-fetch', () => ({
	__esModule: true,
	default: jest.fn(),
}));

jest.mock('@wordpress/url', () => ({
	addQueryArgs: (path, args) => {
		const params = new URLSearchParams(args).toString();
		return `${path}?${params}`;
	},
}));

const POST = { kind: 'post', id: 7 };
const PART = { kind: 'template-part', partSlug: 'header' };

let apiFetch;

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	apiFetch = require('@wordpress/api-fetch').default;
	apiFetch.mockReset();
});

describe('prefetchBlockSource — short-circuits', () => {
	it('returns null and skips the fetch when the source is missing', async () => {
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		expect(prefetchBlockSource(null, 12)).toBeNull();
		expect(apiFetch).not.toHaveBeenCalled();
	});

	it('returns null and skips the fetch when blockId is missing', async () => {
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		expect(prefetchBlockSource(POST, null)).toBeNull();
		expect(apiFetch).not.toHaveBeenCalled();
	});

	it('returns null for sources loaded through other endpoints (product/wpforms/nav)', async () => {
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		expect(prefetchBlockSource({ kind: 'product', id: 9 }, 12)).toBeNull();
		expect(prefetchBlockSource({ kind: 'template-part' }, 12)).toBeNull();
		expect(apiFetch).not.toHaveBeenCalled();
	});
});

describe('prefetchBlockSource — request shape', () => {
	it('passes postId + blockId for a post source', async () => {
		apiFetch.mockResolvedValue({ block: '<p>hi</p>' });
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		await prefetchBlockSource(POST, 12);
		expect(apiFetch).toHaveBeenCalledWith({
			path: '/extendify/v1/agent/get-block-code?postId=7&blockId=12',
		});
	});

	it('passes partSlug + blockId for a template-part source', async () => {
		apiFetch.mockResolvedValue({ block: '<p>hi</p>' });
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		await prefetchBlockSource(PART, 32);
		expect(apiFetch).toHaveBeenCalledWith({
			path: '/extendify/v1/agent/get-block-code?partSlug=header&blockId=32',
		});
	});
});

describe('prefetchBlockSource — cache semantics', () => {
	it('returns the same in-flight Promise for repeated calls with the same key', async () => {
		apiFetch.mockReturnValue(new Promise(() => {}));
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		const a = prefetchBlockSource(POST, 12);
		const b = prefetchBlockSource(POST, 12);
		expect(a).toBe(b);
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});

	it('caches by (kind, discriminator, blockId) — different keys fetch independently', async () => {
		apiFetch.mockResolvedValue({});
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		await prefetchBlockSource(POST, 12);
		await prefetchBlockSource(POST, 13);
		await prefetchBlockSource({ kind: 'post', id: 8 }, 12);
		expect(apiFetch).toHaveBeenCalledTimes(3);
	});

	it('does not collide post #N with template-part #N (separate numbering spaces)', async () => {
		apiFetch.mockResolvedValue({});
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		await prefetchBlockSource(POST, 5);
		await prefetchBlockSource(PART, 5);
		expect(apiFetch).toHaveBeenCalledTimes(2);
	});
});

describe('prefetchBlockSource — failure eviction', () => {
	it('evicts the cache entry on fetch rejection so the next call retries', async () => {
		apiFetch
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValueOnce({ block: '<p>ok</p>' });
		const { prefetchBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);

		await expect(prefetchBlockSource(POST, 12)).rejects.toThrow('boom');
		const second = prefetchBlockSource(POST, 12);
		await expect(second).resolves.toEqual({ block: '<p>ok</p>' });
		expect(apiFetch).toHaveBeenCalledTimes(2);
	});
});

describe('getBlockSource — alias of prefetchBlockSource', () => {
	it('is the exact same function reference', async () => {
		const mod = await import('@quick-edit/lib/block-source-cache');
		expect(mod.getBlockSource).toBe(mod.prefetchBlockSource);
	});
});

describe('invalidateBlockSource', () => {
	it('drops only the specified (source, blockId) entry', async () => {
		apiFetch.mockResolvedValue({});
		const { prefetchBlockSource, invalidateBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		await prefetchBlockSource(POST, 12);
		await prefetchBlockSource(POST, 13);

		invalidateBlockSource(POST, 12);
		await prefetchBlockSource(POST, 12);
		await prefetchBlockSource(POST, 13);

		expect(apiFetch).toHaveBeenCalledTimes(3);
	});

	it('invalidates a template-part entry independently of the post entry', async () => {
		apiFetch.mockResolvedValue({});
		const { prefetchBlockSource, invalidateBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		await prefetchBlockSource(POST, 5);
		await prefetchBlockSource(PART, 5);

		invalidateBlockSource(PART, 5);
		await prefetchBlockSource(POST, 5); // still cached → no refetch
		await prefetchBlockSource(PART, 5); // evicted → refetch

		expect(apiFetch).toHaveBeenCalledTimes(3);
	});

	it('is a no-op for missing source / blockId', async () => {
		const { invalidateBlockSource } = await import(
			'@quick-edit/lib/block-source-cache'
		);
		expect(() => invalidateBlockSource(null, 12)).not.toThrow();
		expect(() => invalidateBlockSource(POST, null)).not.toThrow();
	});
});
