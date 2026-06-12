// The simple toolbar self-runs init() at import. When framed (Customizer
// preview, page-builder previews) it must wire nothing — the server skips
// rendering #extendify-toolbar there too, but page-builder previews still
// load the bundle, so the JS guard is what stops it in those.

let mockEmbedded = false;
jest.mock('@shared/lib/embedded-guard', () => ({
	isEmbedded: () => mockEmbedded,
}));

const renderToolbar = () => {
	document.body.innerHTML = `
		<div id="extendify-toolbar">
			<button type="button" id="ext-tb-quick-edit" role="switch" aria-checked="false">Quick Edit</button>
		</div>
	`;
};

const importToolbar = async () => {
	await jest.isolateModulesAsync(async () => {
		await import('@toolbar/toolbar');
	});
};

beforeEach(() => {
	jest.resetModules();
	mockEmbedded = false;
	document.documentElement.className = '';
	document.body.innerHTML = '';
});

describe('toolbar — embedded guard', () => {
	it('wires the Quick Edit toggle on a top-level render (control)', async () => {
		renderToolbar();
		await importToolbar();

		const onToggle = jest.fn();
		window.addEventListener('extendify-quick-edit:toggle', onToggle);
		document.getElementById('ext-tb-quick-edit').click();
		window.removeEventListener('extendify-quick-edit:toggle', onToggle);

		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it('wires nothing when embedded — the Quick Edit toggle is inert', async () => {
		mockEmbedded = true;
		renderToolbar();
		await importToolbar();

		const onToggle = jest.fn();
		window.addEventListener('extendify-quick-edit:toggle', onToggle);
		document.getElementById('ext-tb-quick-edit').click();
		window.removeEventListener('extendify-quick-edit:toggle', onToggle);

		expect(onToggle).not.toHaveBeenCalled();
	});
});
