// Pins the QuickEdit side of the cross-bundle `extendify-quick-edit:toggle`
// contract. The Toolbar bundle dispatches the event
// (pinned in tests/unit/Toolbar/toolbar.test.js) so it doesn't have to import
// our store; this file pins that the entry's `mount()` actually wires a window
// listener that flips edit mode on receipt. Without this, a rename/removal of
// the listener would let the Toolbar dispatch into the void — a silent
// orphaned-dispatcher break of the toggle button, with the dispatch side
// staying green.

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
	announcePostReload: jest.fn(),
	attachKeyboardUndo: jest.fn(),
	detachKeyboardUndo: jest.fn(),
}));
jest.mock('@quick-edit/lib/link-suggestions', () => ({
	fetchLinkSuggestions: jest.fn(),
}));

beforeEach(() => {
	jest.resetModules();
	document.documentElement.className = '';
	document.body.innerHTML = '';
	localStorage.clear();
	delete window.extQuickEditData;
});

const loadEntry = () => require('@quick-edit/quick-edit');
const getEditModeStore = () =>
	require('@quick-edit/state/edit-mode').useEditModeStore;
// domReady is mocked to a no-op, so mount() never runs on its own; grab the
// callback the entry handed it and invoke it to register the listeners.
const runMount = () => {
	const domReady = require('@wordpress/dom-ready');
	domReady.mock.calls[0][0]();
};

describe('quick-edit entry — cross-bundle toggle listener', () => {
	it('flips edit mode when the Toolbar dispatches extendify-quick-edit:toggle', () => {
		// defaultOn:false so the top-level re-seed leaves edit mode off.
		window.extQuickEditData = { defaultOn: false };
		// mount() bails without a tagged target on the page.
		document.body.innerHTML = '<div data-extendify-agent-block-id="1"></div>';
		loadEntry();
		const editMode = getEditModeStore();
		expect(editMode.getState().on).toBe(false);

		runMount();

		window.dispatchEvent(new CustomEvent('extendify-quick-edit:toggle'));
		expect(editMode.getState().on).toBe(true);

		window.dispatchEvent(new CustomEvent('extendify-quick-edit:toggle'));
		expect(editMode.getState().on).toBe(false);
	});

	it('wires no toggle listener when mount() bails (no tagged targets)', () => {
		window.extQuickEditData = { defaultOn: false };
		loadEntry();
		const editMode = getEditModeStore();

		runMount();

		window.dispatchEvent(new CustomEvent('extendify-quick-edit:toggle'));
		expect(editMode.getState().on).toBe(false);
	});
});
