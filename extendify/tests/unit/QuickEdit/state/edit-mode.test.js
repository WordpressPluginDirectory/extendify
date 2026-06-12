// Mock zustand's persist middleware so it runs synchronously and we don't
// have to coordinate hydration timing per test.
jest.mock('zustand/middleware', () => ({
	devtools: (fn) => fn,
	persist: (config) => config,
}));

jest.mock('@quick-edit/lib/insights', () => ({
	track: jest.fn(),
}));

const HTML_CLASS = 'extendify-quick-edit-on';

const loadStore = async () => {
	const mod = await import('@quick-edit/state/edit-mode');
	return mod.useEditModeStore;
};

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	document.documentElement.className = '';
	window.extQuickEditData = undefined;
});

describe('useEditModeStore — initial state', () => {
	it('defaults on=false and clears the HTML class when no extQuickEditData', async () => {
		const useEditModeStore = await loadStore();
		expect(useEditModeStore.getState().on).toBe(false);
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(false);
	});

	it('honors extQuickEditData.defaultOn=true and applies the HTML class at import time', async () => {
		window.extQuickEditData = { defaultOn: true };
		const useEditModeStore = await loadStore();
		expect(useEditModeStore.getState().on).toBe(true);
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(true);
	});

	it('coerces extQuickEditData.defaultOn to a boolean (truthy non-bool → true)', async () => {
		window.extQuickEditData = { defaultOn: 'yes' };
		const useEditModeStore = await loadStore();
		expect(useEditModeStore.getState().on).toBe(true);
	});
});

describe('useEditModeStore — actions', () => {
	it('setOn updates the flag', async () => {
		const useEditModeStore = await loadStore();
		useEditModeStore.getState().setOn(true);
		expect(useEditModeStore.getState().on).toBe(true);
		useEditModeStore.getState().setOn(false);
		expect(useEditModeStore.getState().on).toBe(false);
	});

	it('setOn coerces non-bool args to booleans', async () => {
		const useEditModeStore = await loadStore();
		useEditModeStore.getState().setOn('yes');
		expect(useEditModeStore.getState().on).toBe(true);
	});

	it('setOn is a no-op when the value is unchanged (does not refire subscribers)', async () => {
		const useEditModeStore = await loadStore();
		const insights = require('@quick-edit/lib/insights');
		insights.track.mockClear();
		useEditModeStore.getState().setOn(false); // already false
		expect(insights.track).not.toHaveBeenCalled();
	});

	it('toggle flips on', async () => {
		const useEditModeStore = await loadStore();
		useEditModeStore.getState().toggle();
		expect(useEditModeStore.getState().on).toBe(true);
		useEditModeStore.getState().toggle();
		expect(useEditModeStore.getState().on).toBe(false);
	});
});

describe('useEditModeStore — HTML class + insights side effects', () => {
	it('adds the HTML class and tracks edit_mode_on when turning on', async () => {
		const useEditModeStore = await loadStore();
		const insights = require('@quick-edit/lib/insights');
		insights.track.mockClear();
		useEditModeStore.getState().setOn(true);
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(true);
		expect(insights.track).toHaveBeenCalledWith('edit_mode_on');
	});

	it('removes the HTML class and tracks edit_mode_off when turning off', async () => {
		window.extQuickEditData = { defaultOn: true };
		const useEditModeStore = await loadStore();
		const insights = require('@quick-edit/lib/insights');
		insights.track.mockClear();
		useEditModeStore.getState().setOn(false);
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(false);
		expect(insights.track).toHaveBeenCalledWith('edit_mode_off');
	});
});

describe('useEditModeStore — no Agent workflow bridge', () => {
	it('loads without importing useWorkflowStore (no bridge required)', () => {
		const src = require('node:fs').readFileSync(
			require('node:path').resolve(
				__dirname,
				'../../../../src/QuickEdit/state/edit-mode.js',
			),
			'utf8',
		);
		expect(src).not.toMatch(/@agent\/state\/workflows/);
		expect(src).not.toMatch(/useWorkflowStore/);
	});
});

describe('useEditModeStore — no Esc handling', () => {
	it('does not attach a document-level Esc listener (handled by global-escape)', () => {
		const src = require('node:fs').readFileSync(
			require('node:path').resolve(
				__dirname,
				'../../../../src/QuickEdit/state/edit-mode.js',
			),
			'utf8',
		);
		expect(src).not.toMatch(/Escape/);
		expect(src).not.toMatch(/keydown/);
	});
});
