jest.mock('@quick-edit/lib/api', () => ({
	save: jest.fn(() => Promise.resolve({})),
	saveProduct: jest.fn(() => Promise.resolve({})),
	saveSiteIdentity: jest.fn(() => Promise.resolve({})),
	saveWpFormsField: jest.fn(() => Promise.resolve({})),
	saveWpNavigationItem: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@quick-edit/lib/insights', () => ({
	track: jest.fn(),
}));

const STORAGE_KEY = 'extendify-quick-edit-undo-stack-v1';
const ANNOUNCE_KEY = 'extendify-quick-edit-undo-announce';

let api;
let insights;
let alertSpy;
let errorSpy;

// jsdom locks window.location.reload (configurable: false, writable: false).
// Calling it logs a jsdom "Not implemented: navigation" via console.error;
// suppress it here so test output stays readable. We assert success via the
// observable side effects performUndo emits before the reload (track call,
// sessionStorage announce key) instead of asserting on reload itself.

const loadStack = () =>
	JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	window.localStorage.clear();
	window.sessionStorage.clear();

	alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
	errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

	api = require('@quick-edit/lib/api');
	insights = require('@quick-edit/lib/insights');
});

afterEach(() => {
	alertSpy.mockRestore();
	errorSpy.mockRestore();
});

describe('pushUndo', () => {
	it('persists an entry under STORAGE_KEY with kind + ts stamped on', () => {
		const { pushUndo } = require('@quick-edit/state/undo');
		pushUndo({
			postId: 1,
			blockId: 'b-1',
			patches: [{ fieldKey: 'text', value: 'old' }],
		});
		const stack = loadStack();
		expect(stack).toHaveLength(1);
		expect(stack[0]).toMatchObject({
			postId: 1,
			blockId: 'b-1',
			kind: 'patches',
			patches: [{ fieldKey: 'text', value: 'old' }],
		});
		expect(typeof stack[0].ts).toBe('number');
	});

	it('infers kind="block" when entry carries rawBlock', () => {
		const { pushUndo } = require('@quick-edit/state/undo');
		pushUndo({ postId: 1, blockId: 'b-1', rawBlock: '<!-- wp:paragraph -->' });
		expect(loadStack()[0].kind).toBe('block');
	});

	it('respects an explicit kind on the entry', () => {
		const { pushUndo } = require('@quick-edit/state/undo');
		pushUndo({ kind: 'identity', beforeValues: {} });
		expect(loadStack()[0].kind).toBe('identity');
	});

	it('caps depth at 5 (FIFO eviction)', () => {
		const { pushUndo } = require('@quick-edit/state/undo');
		for (let i = 0; i < 7; i++) pushUndo({ postId: i, patches: [] });
		const stack = loadStack();
		expect(stack).toHaveLength(5);
		expect(stack.map((e) => e.postId)).toEqual([2, 3, 4, 5, 6]);
	});

	it('ignores falsy entries', () => {
		const { pushUndo } = require('@quick-edit/state/undo');
		pushUndo(null);
		pushUndo(undefined);
		pushUndo(0);
		expect(loadStack()).toEqual([]);
	});

	it('starts fresh when localStorage holds non-array JSON', () => {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ notAnArray: true }),
		);
		const { pushUndo } = require('@quick-edit/state/undo');
		pushUndo({ postId: 1, patches: [] });
		expect(loadStack()).toHaveLength(1);
	});

	it('starts fresh when localStorage holds non-JSON', () => {
		window.localStorage.setItem(STORAGE_KEY, '{not json');
		const { pushUndo } = require('@quick-edit/state/undo');
		pushUndo({ postId: 1, patches: [] });
		expect(loadStack()).toHaveLength(1);
	});
});

describe('getStackDepth', () => {
	it('reflects current persisted depth', () => {
		const { pushUndo, getStackDepth } = require('@quick-edit/state/undo');
		expect(getStackDepth()).toBe(0);
		pushUndo({ postId: 1, patches: [] });
		pushUndo({ postId: 2, patches: [] });
		expect(getStackDepth()).toBe(2);
	});
});

describe('performUndo', () => {
	it('returns false and is a no-op when stack is empty', () => {
		const { performUndo } = require('@quick-edit/state/undo');
		expect(performUndo()).toBe(false);
		expect(api.save).not.toHaveBeenCalled();
	});

	it('routes the default branch through save()', async () => {
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({
			postId: 1,
			blockId: 'b-1',
			patches: [{ fieldKey: 'text', value: 'old' }],
		});
		expect(performUndo()).toBe(true);
		await flush();
		expect(api.save).toHaveBeenCalledWith({
			postId: 1,
			blockId: 'b-1',
			patches: [{ fieldKey: 'text', value: 'old' }],
		});
	});

	it('strips kind + ts from the save() payload', async () => {
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({ postId: 1, patches: [] });
		performUndo();
		await flush();
		const arg = api.save.mock.calls[0][0];
		expect('kind' in arg).toBe(false);
		expect('ts' in arg).toBe(false);
	});

	it('routes identityReplay through saveSiteIdentity', async () => {
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({ identityReplay: true, beforeValues: { blogname: 'Old' } });
		performUndo();
		await flush();
		expect(api.saveSiteIdentity).toHaveBeenCalledWith({ blogname: 'Old' });
		expect(api.save).not.toHaveBeenCalled();
	});

	it('routes productReplay through saveProduct', async () => {
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({
			productReplay: true,
			productId: 42,
			field: 'regular_price',
			beforeValue: '9.99',
		});
		performUndo();
		await flush();
		expect(api.saveProduct).toHaveBeenCalledWith({
			productId: 42,
			field: 'regular_price',
			value: '9.99',
		});
	});

	it('routes navReplay through saveWpNavigationItem', async () => {
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({
			navReplay: true,
			navPostId: 7,
			itemIndex: 'ref-abc',
			blockType: 'core/navigation-link',
			patches: [{ fieldKey: 'label', value: 'Home' }],
		});
		performUndo();
		await flush();
		expect(api.saveWpNavigationItem).toHaveBeenCalledWith({
			navPostId: 7,
			itemIndex: 'ref-abc',
			blockType: 'core/navigation-link',
			patches: [{ fieldKey: 'label', value: 'Home' }],
		});
	});

	it('routes wpformsReplay through saveWpFormsField', async () => {
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({
			wpformsReplay: true,
			formId: 11,
			fieldId: 1,
			changes: { label: 'Original Label', required: true },
		});
		performUndo();
		await flush();
		expect(api.saveWpFormsField).toHaveBeenCalledWith({
			formId: 11,
			fieldId: 1,
			changes: { label: 'Original Label', required: true },
		});
		expect(api.save).not.toHaveBeenCalled();
	});

	it('pops the entry off the stack before the replay fires', () => {
		const {
			pushUndo,
			performUndo,
			getStackDepth,
		} = require('@quick-edit/state/undo');
		pushUndo({ postId: 1, patches: [] });
		pushUndo({ postId: 2, patches: [] });
		performUndo();
		expect(getStackDepth()).toBe(1);
	});

	it('tracks "undo" and writes the aria-live announce key on success', async () => {
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({ postId: 1, patches: [], kind: 'patches' });
		performUndo();
		await flush();
		expect(insights.track).toHaveBeenCalledWith('undo', { kind: 'patches' });
		expect(window.sessionStorage.getItem(ANNOUNCE_KEY)).toBe(
			'Reverted last change.',
		);
	});

	it('tracks "undo_failed", alerts, and skips the announce key when the replay rejects', async () => {
		api.save.mockReturnValueOnce(Promise.reject(new Error('boom')));
		const { pushUndo, performUndo } = require('@quick-edit/state/undo');
		pushUndo({ postId: 1, patches: [], kind: 'patches' });
		performUndo();
		await flush();
		expect(insights.track).toHaveBeenCalledWith('undo_failed', {
			kind: 'patches',
		});
		expect(alertSpy).toHaveBeenCalledWith('Undo failed: boom');
		expect(window.sessionStorage.getItem(ANNOUNCE_KEY)).toBeNull();
	});
});

describe('ANNOUNCE_STORAGE_KEY', () => {
	it('exposes the sessionStorage key for the announce message', () => {
		const { ANNOUNCE_STORAGE_KEY } = require('@quick-edit/state/undo');
		expect(ANNOUNCE_STORAGE_KEY).toBe(ANNOUNCE_KEY);
	});
});
