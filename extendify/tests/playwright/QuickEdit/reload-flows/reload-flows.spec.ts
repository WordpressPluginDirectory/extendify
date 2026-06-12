import { expect, test } from '../../fixtures';

// Characterization: the surfaces whose save contract triggers a full
// page reload. Site identity (wp_options) and
// ref-based nav items (wp_navigation CPT) cascade to enough render
// paths that the rebuild's onAfterSave reloads on `didSave=true`
// instead of splicing in place — pin that reload as observable
// behavior, then pin that the new value is visible after the reload.
// The WC product variant of this reload contract lives in the sibling
// wc-product blueprint, which installs WooCommerce.

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

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('site title save reloads and shows the new title in the header', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	// Header + footer both render the site title in extendable, so a
	// bare `.wp-block-site-title` locator trips strict mode. Target the
	// header explicitly.
	const headerSiteTitle = page
		.getByRole('banner')
		.locator('.wp-block-site-title')
		.first();
	await hoverAndOpenModal(page, headerSiteTitle);

	const modal = dialog(page, /Site title/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);

	const titleInput = modal.getByLabel(/Site title/i);
	await expect(titleInput).toHaveValue('Original Site Title');
	await titleInput.fill('Renamed via Quick Edit');

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

	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-site-title')
			.filter({ hasText: 'Renamed via Quick Edit' }),
	).toBeVisible();
});

test('site tagline save reloads and shows the new tagline', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const tagline = page
		.getByRole('banner')
		.locator('.wp-block-site-tagline')
		.first();
	await hoverAndOpenModal(page, tagline);

	const modal = dialog(page, /Tagline/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);

	// Initial value is whatever the shared blueprint left in blogdescription
	// (the global-setup sentinel) — PHPUnit pins the prefill
	// shape, so the E2E just needs the input to exist before we fill it.
	const taglineInput = modal.getByLabel(/Tagline/i);
	await expect(taglineInput).toBeVisible();
	await taglineInput.fill('Tagline renamed via Quick Edit');

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

	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-site-tagline')
			.filter({ hasText: 'Tagline renamed via Quick Edit' }),
	).toBeVisible();
});

test('site logo Change opens the wp.media frame', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const logo = page.getByRole('banner').locator('.wp-block-site-logo').first();
	await hoverAndOpenModal(page, logo);

	const modal = dialog(page, /Site logo/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);
	// Seeded site_logo loads the modal in the "set" state, so the secondary
	// button reads "Change logo" rather than "Choose logo". Both open the
	// same MediaUpload frame — assert at the "frame opens" level per the
	// image-flows posture; don't drive the wp.media UI itself.
	await modal.getByRole('button', { name: /Change logo/i }).click();
	await expect(page.locator('.media-modal')).toBeVisible();
});

test('site logo Remove + Save clears site_logo, reloads with no logo image', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const logo = page.getByRole('banner').locator('.wp-block-site-logo').first();
	await expect(logo).toBeVisible();
	await hoverAndOpenModal(page, logo);

	const modal = dialog(page, /Site logo/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);
	await modal.getByRole('button', { name: /^Remove$/i }).click();

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/site-identity') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	const savedRes = await saved;
	// SiteIdentityModal sends only the dirty field; pin the Remove path's
	// payload shape (logo_id=0 is what the controller turns into
	// delete_option('site_logo')).
	const body = JSON.parse(savedRes.request().postData() || '{}');
	expect(body).toEqual({ logo_id: 0 });
	await reloaded;

	// core/site-logo renders empty markup when site_logo is unset, so the
	// <img> disappears. Asserting on the image (not the wrapper) stays
	// resilient to whether WP emits an empty wrapper or omits the block.
	await expect(
		page.getByRole('banner').locator('.wp-block-site-logo img'),
	).toHaveCount(0);
});

// Order matters: tests in a spec file run sequentially against the
// same wp-playground server, and the label-save test below persists
// "About Renamed" to the wp_navigation post. Pin the original tagged
// DOM first, before any mutation lands.
test('NavRefTagger surfaces nav-ref on the wrapper and sequential nav-item-index attrs on each item', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	// `data-extendify-quick-edit-nav-ref` carries the wp_navigation post
	// id so the JS side can route saves to that post. The exact id
	// depends on insert order in setup.php; only the contract (positive
	// int) is stable across reseeds.
	const navWrapper = page
		.getByRole('banner')
		.locator('nav[data-extendify-quick-edit-nav-ref]')
		.first();
	await expect(navWrapper).toBeVisible();
	const ref = await navWrapper.getAttribute(
		'data-extendify-quick-edit-nav-ref',
	);
	expect(Number(ref)).toBeGreaterThan(0);

	// `data-extendify-quick-edit-nav-item-index` counts 0..N-1 in
	// render order. The WPNavigationController walk uses the same
	// pre-order counter, so what the tagger emits at render time is
	// what the save endpoint resolves at write time —
	// PHPUnit pins the walk algorithm; this assertion pins the
	// tagged DOM that algorithm has to match.
	const items = page
		.getByRole('banner')
		.locator(
			'.wp-block-navigation-item[data-extendify-quick-edit-nav-item-index]',
		);
	await expect(items).toHaveCount(3);
	const labels = ['Original Home', 'Original About', 'Original Contact'];
	for (let i = 0; i < labels.length; i++) {
		await expect(items.nth(i)).toHaveAttribute(
			'data-extendify-quick-edit-nav-item-index',
			String(i),
		);
		await expect(items.nth(i)).toContainText(labels[i]);
	}
});

test('ref-based nav item label save posts to /quick-edit/wp-navigation and reloads with the new label', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	// Three items in the seeded wp_navigation post: Home (index 0),
	// About (1), Contact (2). Hover the middle item so the asserted
	// itemIndex is past zero — a positional bug that hardcoded 0
	// would still pass for Home.
	const aboutItem = page
		.getByRole('banner')
		.locator('.wp-block-navigation-item')
		.filter({ hasText: 'Original About' });
	await hoverAndOpenModal(page, aboutItem);

	const modal = dialog(page, /Edit navigation link/i);
	await expect(modal).toBeVisible();

	const labelInput = modal.getByLabel(/^Label$/i);
	await expect(labelInput).toHaveValue('Original About');
	await labelInput.fill('About Renamed');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/wp-navigation') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	const savedRes = await saved;

	// `patches` only carries dirty fields — URL wasn't touched, so it
	// stays out of the payload. The ref-based contract is addressed
	// by (navPostId, itemIndex), not by positional traversal of the
	// rendered template-part.
	const body = JSON.parse(savedRes.request().postData() || '{}');
	expect(Number(body.navPostId)).toBeGreaterThan(0);
	expect(body.itemIndex).toBe(1);
	expect(body.blockType).toBe('core/navigation-link');
	expect(body.patches).toEqual([{ fieldKey: 'label', value: 'About Renamed' }]);
	await reloaded;

	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-navigation-item')
			.filter({ hasText: 'About Renamed' }),
	).toBeVisible();
	// The other two items still render unchanged after the reload —
	// the wp-navigation walk only patched the addressed item.
	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-navigation-item')
			.filter({ hasText: 'Original Home' }),
	).toBeVisible();
	await expect(
		page
			.getByRole('banner')
			.locator('.wp-block-navigation-item')
			.filter({ hasText: 'Original Contact' }),
	).toBeVisible();
});
