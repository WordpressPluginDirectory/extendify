// Pins the REST helper shape used by every Quick Edit save path:
// /quick-edit/save, /quick-edit/site-identity, /quick-edit/product,
// /quick-edit/wp-navigation, /quick-edit/wpforms. fetch is mocked at the
// global level so each test can inspect the exact URL, method, headers,
// and body the call site emits.

import * as api from '@quick-edit/lib/api';

const setExtData = (overrides = {}) => {
	window.extQuickEditData = {
		restRoot: 'https://wp.test/wp-json/extendify/v1',
		nonce: 'qe-nonce',
		...overrides,
	};
};

const mockFetch = (responder) => {
	global.fetch = jest.fn(responder);
};

const ok = (json) =>
	Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) });

const fail = (status, json) =>
	Promise.resolve({
		ok: false,
		status,
		json: () => Promise.resolve(json ?? {}),
	});

beforeEach(() => {
	setExtData();
});

afterEach(() => {
	delete global.fetch;
	delete window.extQuickEditData;
});

describe('api.post — request shape', () => {
	it('POSTs to restRoot + path with JSON body, nonce header, same-origin creds', async () => {
		mockFetch(() => ok({ ok: true }));
		await api.post('/foo', { a: 1 });
		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('https://wp.test/wp-json/extendify/v1/foo');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('same-origin');
		expect(init.headers).toEqual({
			'Content-Type': 'application/json',
			'X-WP-Nonce': 'qe-nonce',
		});
		expect(JSON.parse(init.body)).toEqual({ a: 1 });
	});

	it('returns the parsed JSON on a 2xx', async () => {
		mockFetch(() => ok({ saved: true, html: '<p>hi</p>' }));
		const out = await api.post('/foo', {});
		expect(out).toEqual({ saved: true, html: '<p>hi</p>' });
	});
});

describe('api.post — error mapping', () => {
	it('throws with message from json.message and exposes status + body', async () => {
		mockFetch(() => fail(422, { message: 'invalid' }));
		await expect(api.post('/foo', {})).rejects.toMatchObject({
			message: 'invalid',
			status: 422,
			body: { message: 'invalid' },
		});
	});

	it('falls back to json.error when message is absent', async () => {
		mockFetch(() => fail(400, { error: 'bad shape' }));
		await expect(api.post('/foo', {})).rejects.toMatchObject({
			message: 'bad shape',
			status: 400,
		});
	});

	it('falls back to "HTTP <status>" when the body has no message or error', async () => {
		mockFetch(() => fail(500, {}));
		await expect(api.post('/foo', {})).rejects.toMatchObject({
			message: 'HTTP 500',
			status: 500,
		});
	});

	it('treats a body that fails to parse as empty json', async () => {
		mockFetch(() =>
			Promise.resolve({
				ok: false,
				status: 503,
				json: () => Promise.reject(new Error('parse failed')),
			}),
		);
		await expect(api.post('/foo', {})).rejects.toMatchObject({
			message: 'HTTP 503',
			status: 503,
			body: {},
		});
	});
});

describe('api.get — request shape + error mapping', () => {
	it('GETs to restRoot + path with the nonce header and no body', async () => {
		mockFetch(() => ok({ x: 1 }));
		await api.get('/foo?bar=1');
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('https://wp.test/wp-json/extendify/v1/foo?bar=1');
		expect(init.method).toBe('GET');
		expect(init.credentials).toBe('same-origin');
		expect(init.headers).toEqual({ 'X-WP-Nonce': 'qe-nonce' });
		expect(init.body).toBeUndefined();
	});

	it('throws with body json + status on non-2xx', async () => {
		mockFetch(() => fail(404, { message: 'not found' }));
		await expect(api.get('/foo')).rejects.toMatchObject({
			message: 'not found',
			status: 404,
		});
	});
});

describe('api.save', () => {
	it('routes payload to POST /quick-edit/save, defaulting translatedContext to null', async () => {
		mockFetch(() => ok({}));
		await api.save({ blockId: 12, patches: { content: 'hi' } });
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('https://wp.test/wp-json/extendify/v1/quick-edit/save');
		expect(JSON.parse(init.body)).toEqual({
			blockId: 12,
			patches: { content: 'hi' },
			translatedContext: null,
		});
	});

	it('forwards the page translatedContext so the server can fail closed on text saves', async () => {
		setExtData({
			translatedContext: { isTranslated: true, plugin: 'translatepress' },
		});
		mockFetch(() => ok({}));
		await api.save({
			blockId: 3,
			rawBlock: '<!-- wp:heading --><h2>x</h2><!-- /wp:heading -->',
		});
		const [, init] = fetch.mock.calls[0];
		expect(JSON.parse(init.body).translatedContext).toEqual({
			isTranslated: true,
			plugin: 'translatepress',
		});
	});
});

describe('api.saveSiteIdentity + loadSiteIdentity', () => {
	it('saveSiteIdentity POSTs the payload to /quick-edit/site-identity', async () => {
		mockFetch(() => ok({}));
		await api.saveSiteIdentity({ blogname: 'New' });
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe(
			'https://wp.test/wp-json/extendify/v1/quick-edit/site-identity',
		);
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ blogname: 'New' });
	});

	it('loadSiteIdentity GETs /quick-edit/site-identity', async () => {
		mockFetch(() => ok({ blogname: 'Cur' }));
		const out = await api.loadSiteIdentity();
		expect(fetch.mock.calls[0][0]).toBe(
			'https://wp.test/wp-json/extendify/v1/quick-edit/site-identity',
		);
		expect(fetch.mock.calls[0][1].method).toBe('GET');
		expect(out).toEqual({ blogname: 'Cur' });
	});
});

describe('api.loadProduct + saveProduct', () => {
	it('loadProduct URL-encodes the product id and routes to GET', async () => {
		mockFetch(() => ok({}));
		await api.loadProduct('42 ?');
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe(
			'https://wp.test/wp-json/extendify/v1/quick-edit/product?product_id=42%20%3F',
		);
		expect(init.method).toBe('GET');
	});

	it('saveProduct POSTs {product_id, field, value}', async () => {
		mockFetch(() => ok({}));
		await api.saveProduct({ productId: 42, field: 'name', value: 'New' });
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('https://wp.test/wp-json/extendify/v1/quick-edit/product');
		expect(JSON.parse(init.body)).toEqual({
			product_id: 42,
			field: 'name',
			value: 'New',
		});
	});
});

describe('api.saveWpNavigationItem', () => {
	it('POSTs ref-based nav payload verbatim (navPostId / itemIndex / blockType / patches)', async () => {
		mockFetch(() => ok({}));
		await api.saveWpNavigationItem({
			navPostId: 7,
			itemIndex: 2,
			blockType: 'core/navigation-link',
			patches: { label: 'Home', url: '/' },
		});
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe(
			'https://wp.test/wp-json/extendify/v1/quick-edit/wp-navigation',
		);
		expect(JSON.parse(init.body)).toEqual({
			navPostId: 7,
			itemIndex: 2,
			blockType: 'core/navigation-link',
			patches: { label: 'Home', url: '/' },
		});
	});
});

describe('api.loadWpFormsField + saveWpFormsField', () => {
	it('loadWpFormsField URL-encodes both form_id and field_id', async () => {
		mockFetch(() => ok({}));
		await api.loadWpFormsField({ formId: '1&', fieldId: '2 ' });
		const [url] = fetch.mock.calls[0];
		expect(url).toBe(
			'https://wp.test/wp-json/extendify/v1/quick-edit/wpforms?form_id=1%26&field_id=2%20',
		);
	});

	it('saveWpFormsField POSTs {form_id, field_id, changes}', async () => {
		mockFetch(() => ok({}));
		await api.saveWpFormsField({
			formId: 1,
			fieldId: 2,
			changes: { label: 'New' },
		});
		const [, init] = fetch.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			form_id: 1,
			field_id: 2,
			changes: { label: 'New' },
		});
	});
});

describe('api — extQuickEditData fallback', () => {
	it('reads restRoot + nonce from an empty extQuickEditData (URL becomes "undefined<path>")', async () => {
		// Pinning current behavior: api.js destructures missing fields as
		// undefined and interpolates them verbatim. If we ever tighten this
		// to fail loudly, update the test.
		delete window.extQuickEditData;
		mockFetch(() => ok({}));
		await api.get('/foo');
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('undefined/foo');
		expect(init.headers['X-WP-Nonce']).toBeUndefined();
	});
});
