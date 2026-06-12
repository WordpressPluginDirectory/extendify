// Pins the cross-bundle race fix in quick-edit.jsx: when the Agent bundle
// imports `@quick-edit/state/edit-mode` and evaluates the shared chunk
// before our `'before'` inline script has set `window.extQuickEditData`,
// `DEFAULT_ON` in edit-mode.js resolves to false. By the time this entry
// bundle loads its own inline data is reliably set, so the IIFE re-seeds
// the store to honor the server's defaultOn unless the user has a
// persisted choice.

jest.mock('@wordpress/dom-ready', () => jest.fn());
jest.mock('@wordpress/element', () => {
	const actual = jest.requireActual('@wordpress/element');
	return {
		...actual,
		createRoot: jest.fn(() => ({ render: jest.fn() })),
		render: jest.fn(),
	};
});
jest.mock('@wordpress/data', () => ({
	dispatch: () => ({ updateSettings: jest.fn() }),
}));
jest.mock('zustand/middleware', () => ({
	devtools: (fn) => fn,
	persist: (config) => config,
}));
jest.mock('@quick-edit/lib/insights', () => ({ track: jest.fn() }));
jest.mock('@quick-edit/components/InlineEditor', () => ({
	InlineEditor: () => null,
}));
jest.mock('@quick-edit/lib/admin-bar', () => ({
	bindAdminBarToggle: jest.fn(),
}));
jest.mock('@quick-edit/lib/global-escape', () => ({
	wireGlobalEscape: jest.fn(),
}));
jest.mock('@quick-edit/lib/hover-bar', () => ({
	attach: jest.fn(),
	detach: jest.fn(),
}));
jest.mock('@quick-edit/lib/keyboard-entry', () => ({
	attachKeyboardEntry: jest.fn(),
	detachKeyboardEntry: jest.fn(),
}));
jest.mock('@quick-edit/lib/keyboard-undo', () => ({
	attachKeyboardUndo: jest.fn(),
	detachKeyboardUndo: jest.fn(),
}));
jest.mock('@quick-edit/lib/link-suggestions', () => ({
	fetchLinkSuggestions: jest.fn(),
}));

beforeEach(() => {
	jest.resetModules();
	document.documentElement.className = '';
	localStorage.clear();
	delete window.extQuickEditData;
});

const loadEntry = () => require('@quick-edit/quick-edit');
const getEditModeStore = () =>
	require('@quick-edit/state/edit-mode').useEditModeStore;

describe('quick-edit entry — defaultOn re-seed', () => {
	it('re-seeds on=true when extQuickEditData arrives after edit-mode.js evaluated', () => {
		// Simulate the race: edit-mode.js evaluates first (no extQuickEditData
		// yet), then the entry bundle's inline lands the data, then the entry
		// evaluates. After the entry loads, on should be true.
		const editMode = getEditModeStore();
		expect(editMode.getState().on).toBe(false);

		window.extQuickEditData = { defaultOn: true };
		loadEntry();

		expect(editMode.getState().on).toBe(true);
	});

	it('does not re-seed when extQuickEditData.defaultOn is false', () => {
		const editMode = getEditModeStore();
		window.extQuickEditData = { defaultOn: false };
		loadEntry();

		expect(editMode.getState().on).toBe(false);
	});

	it('does not override a persisted user choice (off) even when defaultOn is true', () => {
		// User explicitly toggled off in a prior session — persist hydrates
		// to false. The seed must not blow that away.
		localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: false }, version: 0 }),
		);
		const editMode = getEditModeStore();
		window.extQuickEditData = { defaultOn: true };
		loadEntry();

		expect(editMode.getState().on).toBe(false);
	});

	it('leaves on=true alone when both server and persist agree', () => {
		localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
		window.extQuickEditData = { defaultOn: true };
		const editMode = getEditModeStore();
		editMode.setState({ on: true });
		loadEntry();

		expect(editMode.getState().on).toBe(true);
	});
});
