// The `extendify-quick-edit-on` html class must never be applied inside
// another tool's iframe. edit-mode.js ships in both the QuickEdit and Agent
// bundles, so guarding the class here is what keeps the Customizer preview
// (and page-builder previews) from looking edit-on even when the QE bundle
// itself is gone.

jest.mock('zustand/middleware', () => ({
	devtools: (fn) => fn,
	persist: (config) => config,
}));
jest.mock('@quick-edit/lib/insights', () => ({ track: jest.fn() }));
jest.mock('@shared/lib/embedded-guard', () => ({ isEmbedded: jest.fn() }));

const HTML_CLASS = 'extendify-quick-edit-on';

const loadStore = async ({ embedded, defaultOn }) => {
	require('@shared/lib/embedded-guard').isEmbedded.mockReturnValue(embedded);
	window.extQuickEditData = defaultOn ? { defaultOn: true } : undefined;
	const mod = await import('@quick-edit/state/edit-mode');
	return mod.useEditModeStore;
};

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	document.documentElement.className = '';
	window.extQuickEditData = undefined;
});

describe('edit-mode: extendify-quick-edit-on guarded by isEmbedded', () => {
	it('applies the on-class at import on a top-level render', async () => {
		await loadStore({ embedded: false, defaultOn: true });
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(true);
	});

	it('does NOT apply the on-class at import when embedded', async () => {
		await loadStore({ embedded: true, defaultOn: true });
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(false);
	});

	it('keeps the on-class off when an embedded state change turns edit mode on', async () => {
		const useEditModeStore = await loadStore({
			embedded: true,
			defaultOn: false,
		});
		useEditModeStore.getState().setOn(true);
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(false);
	});

	it('applies the on-class on a top-level state change (control)', async () => {
		const useEditModeStore = await loadStore({
			embedded: false,
			defaultOn: false,
		});
		useEditModeStore.getState().setOn(true);
		expect(document.documentElement.classList.contains(HTML_CLASS)).toBe(true);
	});
});
