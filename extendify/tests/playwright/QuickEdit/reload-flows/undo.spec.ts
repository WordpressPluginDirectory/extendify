import { expect, test } from '../../fixtures';

// Characterization: Cmd+Z after a reload-flow save. The
// inline-text spec pins the round-trip for the default `save()` branch; this
// spec pins the keyboard → store → REST round-trip for the two non-text
// branches the reload-flows blueprint exposes — `identityReplay` (site
// identity) and `navReplay` (ref-based nav). Both write to localStorage at
// save time, survive the reload, and dispatch through performUndo on Cmd+Z.
//
// Assertions pin the undo POST body, not just the HTTP 200, so a future undo
// refactor can't silently no-op into a successful 200 that didn't actually
// replay the pre-mutation values. The post-reload DOM assertion catches the
// other half: that the controller really did apply the patch.

const adminBarPill = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const hoverAndOpenModal = async (page, locator) => {
	await locator.scrollIntoViewIfNeeded();
	await locator.hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await bar.getByRole('button', { name: /Quick Edit/ }).click();
};

const dialog = (page, name: RegExp) => page.getByRole('dialog', { name });

// Prefill modals mount their labeled inputs only after an async REST GET
// resolves — until then they show a Spinner and keep Save disabled
// (disabled={saving || !data}). On a starved CI runner that GET can outlast
// expect()'s 5s default, racing the input assertions. Gate on Save enabled
// (= data loaded) before touching the inputs.
const waitForModalData = (modal) =>
	expect(modal.getByRole('button', { name: /^Save$/ })).toBeEnabled({
		timeout: 15_000,
	});

// The modal save reloads the page; QE must re-mount and re-bind its Cmd+Z
// handler before the undo press. mount() appends #extendify-quick-edit-root
// just before calling attachKeyboardUndo(), so that host is the post-reload
// readiness signal — on a starved runner the bundle can still be loading when
// the press would otherwise fire (root absent → no handler, undo no-ops).
const waitForQuickEditReady = (page) =>
	expect(page.locator('#extendify-quick-edit-root')).toBeAttached({
		timeout: 15_000,
	});

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Cmd+Z after a site title save POSTs the original title back through /quick-edit/site-identity and the header re-renders the original value', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const headerSiteTitle = page
		.getByRole('banner')
		.locator('.wp-block-site-title')
		.first();
	await hoverAndOpenModal(page, headerSiteTitle);

	const modal = dialog(page, /Site title/i);
	await waitForModalData(modal);
	const titleInput = modal.getByLabel(/Site title/i);
	await expect(titleInput).toHaveValue('Original Site Title');
	await titleInput.fill('Renamed via Quick Edit (undo)');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/site-identity') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	await saved;
	await reloaded;

	// Sanity-check the post-save DOM before driving the undo — pins that the
	// forward half of the round-trip really landed.
	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-site-title')
			.filter({ hasText: 'Renamed via Quick Edit (undo)' }),
	).toBeVisible();

	await waitForQuickEditReady(page);

	// SiteIdentityModal stamps `beforeValues = { title: '<original>' }` into
	// the undo entry; performUndo dispatches on `identityReplay` and POSTs
	// beforeValues straight to /quick-edit/site-identity.
	const undoSaved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/site-identity') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const undoReloaded = page.waitForLoadState('load');
	await page.locator('body').press('ControlOrMeta+z');
	const undoRes = await undoSaved;
	expect(JSON.parse(undoRes.request().postData() || '{}')).toEqual({
		title: 'Original Site Title',
	});
	await undoReloaded;

	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-site-title')
			.filter({ hasText: 'Original Site Title' }),
	).toBeVisible();
	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-site-title')
			.filter({ hasText: 'Renamed via Quick Edit (undo)' }),
	).toHaveCount(0);
});

test('Cmd+Z after a ref-based nav label save POSTs the original label + URL patches back through /quick-edit/wp-navigation and the nav re-renders the original label', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const aboutItem = page
		.getByRole('banner')
		.locator('.wp-block-navigation-item')
		.filter({ hasText: 'Original About' });
	await hoverAndOpenModal(page, aboutItem);

	const modal = dialog(page, /Edit navigation link/i);
	const labelInput = modal.getByLabel(/^Label$/i);
	await expect(labelInput).toHaveValue('Original About');
	await labelInput.fill('About Renamed (undo)');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/wp-navigation') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	await saved;
	await reloaded;

	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-navigation-item')
			.filter({ hasText: 'About Renamed (undo)' }),
	).toBeVisible();

	await waitForQuickEditReady(page);

	// NavItemModal stamps the undo entry with BOTH label + url at their
	// pre-mutation values — even though only label was dirty on the forward
	// save. The URL patch is idempotent (replays /about → /about) but a
	// hand-edited URL post-save would still be restored on undo.
	const undoSaved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/wp-navigation') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const undoReloaded = page.waitForLoadState('load');
	await page.locator('body').press('ControlOrMeta+z');
	const undoRes = await undoSaved;
	const undoBody = JSON.parse(undoRes.request().postData() || '{}');
	expect(Number(undoBody.navPostId)).toBeGreaterThan(0);
	expect(undoBody.itemIndex).toBe(1);
	expect(undoBody.blockType).toBe('core/navigation-link');
	expect(undoBody.patches).toEqual([
		{ fieldKey: 'label', value: 'Original About' },
		{ fieldKey: 'url', value: '/about' },
	]);
	await undoReloaded;

	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-navigation-item')
			.filter({ hasText: 'Original About' }),
	).toBeVisible();
	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-navigation-item')
			.filter({ hasText: 'About Renamed (undo)' }),
	).toHaveCount(0);
});
