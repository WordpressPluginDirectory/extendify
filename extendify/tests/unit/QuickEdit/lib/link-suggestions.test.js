// Thin wrapper over /wp/v2/search; LinkControl in the inline editor calls
// this via the settings prop. Tests pin the param shape, defaults, and the
// result reshape to {id,url,title,type,kind}.

jest.mock('@wordpress/api-fetch', () => ({
	__esModule: true,
	default: jest.fn(),
}));

let apiFetch;
let fetchLinkSuggestions;

beforeEach(async () => {
	jest.resetModules();
	jest.clearAllMocks();
	apiFetch = require('@wordpress/api-fetch').default;
	apiFetch.mockReset();
	apiFetch.mockResolvedValue([]);
	fetchLinkSuggestions = (await import('@quick-edit/lib/link-suggestions'))
		.fetchLinkSuggestions;
});

const decodePath = () => {
	const path = apiFetch.mock.calls[0][0].path;
	const [base, qs] = path.split('?');
	return { base, params: new URLSearchParams(qs) };
};

describe('fetchLinkSuggestions — request shape', () => {
	it('hits /wp/v2/search with search + per_page (default 10)', async () => {
		await fetchLinkSuggestions('hello');
		const { base, params } = decodePath();
		expect(base).toBe('/wp/v2/search');
		expect(params.get('search')).toBe('hello');
		expect(params.get('per_page')).toBe('10');
		expect(params.has('type')).toBe(false);
		expect(params.has('subtype')).toBe(false);
	});

	it('passes opts.perPage / type / subtype when supplied', async () => {
		await fetchLinkSuggestions('hi', {
			perPage: 5,
			type: 'post',
			subtype: 'page',
		});
		const { params } = decodePath();
		expect(params.get('per_page')).toBe('5');
		expect(params.get('type')).toBe('post');
		expect(params.get('subtype')).toBe('page');
	});

	it('coerces null/empty search to ""', async () => {
		await fetchLinkSuggestions(null);
		expect(decodePath().params.get('search')).toBe('');
		await fetchLinkSuggestions(undefined);
		expect(decodePath().params.get('search')).toBe('');
	});

	it('encodes special characters in search', async () => {
		await fetchLinkSuggestions('a & b?');
		expect(decodePath().params.get('search')).toBe('a & b?');
	});
});

describe('fetchLinkSuggestions — result reshape', () => {
	it('maps each row to {id, url, title, type, kind} with subtype winning over type for type', async () => {
		apiFetch.mockResolvedValue([
			{ id: 1, url: '/a', title: 'A', type: 'post', subtype: 'page' },
			{ id: 2, url: '/b', title: 'B', type: 'post' },
		]);

		const out = await fetchLinkSuggestions('x');
		expect(out).toEqual([
			{ id: 1, url: '/a', title: 'A', type: 'page', kind: 'post' },
			{ id: 2, url: '/b', title: 'B', type: 'post', kind: 'post' },
		]);
	});

	it('falls back to row.url when title is missing or empty', async () => {
		apiFetch.mockResolvedValue([
			{ id: 1, url: '/a', title: '', type: 'post' },
			{ id: 2, url: '/b', type: 'post' },
		]);
		const out = await fetchLinkSuggestions('x');
		expect(out.map((r) => r.title)).toEqual(['/a', '/b']);
	});

	it('returns [] when apiFetch resolves null/undefined', async () => {
		apiFetch.mockResolvedValue(null);
		await expect(fetchLinkSuggestions('x')).resolves.toEqual([]);
		apiFetch.mockResolvedValue(undefined);
		await expect(fetchLinkSuggestions('x')).resolves.toEqual([]);
	});
});

describe('fetchLinkSuggestions — error propagation', () => {
	it('propagates the apiFetch rejection unchanged', async () => {
		apiFetch.mockRejectedValue(new Error('boom'));
		await expect(fetchLinkSuggestions('x')).rejects.toThrow('boom');
	});
});
