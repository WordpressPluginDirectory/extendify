// Pins the no-PII payload contract per the plan's "no PII to backends"
// hard rule, plus the keepalive + swallow-errors posture and the
// short-circuits (missing event, missing INSIGHTS_HOST).

const mockFetch = jest.fn();

jest.mock('@constants', () => ({
	INSIGHTS_HOST: 'https://insights.test',
	AI_HOST: '',
	PATTERNS_HOST: '',
	IMAGES_HOST: '',
	KB_HOST: '',
}));

jest.mock('@shared/lib/data', () => ({
	reqDataBasics: {
		partnerId: 'p1',
		siteId: 's1',
		version: '1.0.0',
		homeUrl: 'https://my-site.test',
	},
}));

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	global.fetch = mockFetch;
	mockFetch.mockReset();
	mockFetch.mockReturnValue({ catch: () => {} });
});

afterEach(() => {
	delete global.fetch;
});

describe('track — request shape', () => {
	it('POSTs to INSIGHTS_HOST + /api/v1/quick-edit with JSON + Extendify headers + keepalive', async () => {
		const { track } = await import('@quick-edit/lib/insights');
		track('edit_mode_on', { source: 'admin-bar' });

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe('https://insights.test/api/v1/quick-edit');
		expect(init.method).toBe('POST');
		expect(init.keepalive).toBe(true);
		expect(init.headers).toEqual({
			'Content-type': 'application/json',
			Accept: 'application/json',
			'X-Extendify': 'true',
		});
	});
});

describe('track — payload shape (no PII)', () => {
	it('includes only reqDataBasics + event + props + ts', async () => {
		const { track } = await import('@quick-edit/lib/insights');
		track('edit_mode_on', { source: 'admin-bar' });
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);

		expect(Object.keys(body).sort()).toEqual(
			[
				'event',
				'homeUrl',
				'partnerId',
				'props',
				'siteId',
				'ts',
				'version',
			].sort(),
		);
		expect(body.event).toBe('edit_mode_on');
		expect(body.props).toEqual({ source: 'admin-bar' });
		expect(typeof body.ts).toBe('number');
	});

	it('defaults props to an empty object when omitted', async () => {
		const { track } = await import('@quick-edit/lib/insights');
		track('edit_mode_on');
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.props).toEqual({});
	});

	it('forwards the props object verbatim (no field filtering at the helper level)', async () => {
		// Characterization: track() does not sanitize props itself — call sites
		// are responsible for not putting PII into the props bag. If you change
		// this to enforce a deny-list, update this test.
		const { track } = await import('@quick-edit/lib/insights');
		track('edit_mode_on', { foo: 'bar', n: 42 });
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.props).toEqual({ foo: 'bar', n: 42 });
	});
});

describe('track — short-circuits', () => {
	it('does not fire fetch when event is empty', async () => {
		const { track } = await import('@quick-edit/lib/insights');
		track('');
		track(null);
		track(undefined);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('does not fire fetch when INSIGHTS_HOST is falsy', async () => {
		jest.resetModules();
		jest.doMock('@constants', () => ({
			INSIGHTS_HOST: '',
			AI_HOST: '',
			PATTERNS_HOST: '',
			IMAGES_HOST: '',
			KB_HOST: '',
		}));
		const { track } = await import('@quick-edit/lib/insights');
		track('edit_mode_on');
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe('track — error swallowing', () => {
	it('swallows a synchronous throw inside fetch', async () => {
		mockFetch.mockImplementation(() => {
			throw new Error('synchronous boom');
		});
		const { track } = await import('@quick-edit/lib/insights');
		expect(() => track('edit_mode_on')).not.toThrow();
	});

	it('swallows an async fetch rejection (no unhandled rejection)', async () => {
		// Create the rejected promise inside the mock impl so .catch()
		// attaches in the same microtask — otherwise the rejection would
		// surface as unhandled before the dynamic import returns.
		mockFetch.mockImplementation(() => Promise.reject(new Error('async boom')));
		const { track } = await import('@quick-edit/lib/insights');
		expect(() => track('edit_mode_on')).not.toThrow();
		await Promise.resolve();
	});
});
