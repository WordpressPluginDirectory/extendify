import { expect, test } from '../../fixtures';

// Characterization: editing a WooCommerce product through Quick Edit.
// WCProductTagger marks blocks rendered with a product
// postId context with data-extendify-quick-edit-product-id +
// -product-field; the modal posts to /quick-edit/product with
// { product_id, field, value }. After save the page reloads (product
// data cascades through too many WC render surfaces to splice cleanly)
// and the new value is visible in the live DOM.
//
// The PHP-side controller round-trip is fully pinned by
// tests/Integration/QuickEdit/Controllers/WCProductControllerTest.php.
// This spec adds the front-end reload + re-render half.
//
// WC + Block Editor on wp-playground has historically been finicky
// (REST registration order, 256MB memory ceiling). If the blueprint flakes
// in CI, env-gate this spec rather than papering over — the PHPUnit
// coverage above is the canonical safety net.

// Extendify Toolbar replaces the standard WP admin-bar Edit-mode pill on
// the live front end (see app/Toolbar/Frontend.php).
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

// 60s, not the usual 15s: the product prefill is the worker's first
// WooCommerce REST call and pays WC's full REST bootstrap, which runs past
// 15s on cold CI. Save stays disabled until it lands (disabled={saving || !data}).
const waitForModalData = (modal) =>
	expect(modal.getByRole('button', { name: /^Save$/ })).toBeEnabled({
		timeout: 60_000,
	});

const productNameBlock = (page) =>
	page.locator('[data-extendify-quick-edit-product-field="name"]').first();

const productExcerptBlock = (page) =>
	page
		.locator('[data-extendify-quick-edit-product-field="short_description"]')
		.first();

const productPriceBlock = (page) =>
	page.locator('[data-extendify-quick-edit-product-field="price"]').first();

const productImageBlock = (page) =>
	page.locator('[data-extendify-quick-edit-product-field="image"]').first();

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('WCProductTagger surfaces product-id + product-field attrs on each product block', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	await expect(productNameBlock(page)).toBeVisible({ timeout: 15_000 });
	await expect(productExcerptBlock(page)).toBeVisible();
	await expect(productPriceBlock(page)).toBeVisible();
	await expect(productImageBlock(page)).toBeVisible();

	// All four blocks share the same product context — the tagger reads
	// blockObj->context['postId'] which the core/post-template loop sets
	// once per iteration. Drifting ids here would signal the tagger
	// resolved the wrong post.
	const ids = await Promise.all(
		[
			productNameBlock(page),
			productExcerptBlock(page),
			productPriceBlock(page),
			productImageBlock(page),
		].map((loc) => loc.getAttribute('data-extendify-quick-edit-product-id')),
	);
	const unique = [...new Set(ids)];
	expect(unique).toHaveLength(1);
	expect(Number(unique[0])).toBeGreaterThan(0);

	// Hover bar on a product block hides Ask AI — product source isn't
	// in (post|null), and the agent can't save into products.
	await productNameBlock(page).hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toHaveCount(0);
});

test('product name save reloads and re-renders the new title', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	await hoverAndOpenModal(page, productNameBlock(page));

	const modal = dialog(page, /Edit product name/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);

	const nameInput = modal.getByLabel(/Product name/i);
	await expect(nameInput).toHaveValue('Original Product Name');
	await nameInput.fill('Renamed via Quick Edit');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/product') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	const savedRes = await saved;

	const body = JSON.parse(savedRes.request().postData() || '{}');
	expect(body.field).toBe('name');
	expect(body.value).toBe('Renamed via Quick Edit');
	expect(Number(body.product_id)).toBeGreaterThan(0);
	await reloaded;

	await expect(productNameBlock(page)).toContainText('Renamed via Quick Edit');
});

test('product short description save reloads and re-renders the new excerpt', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	await hoverAndOpenModal(page, productExcerptBlock(page));

	const modal = dialog(page, /Edit short description/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);

	const descInput = modal.getByLabel(/Short description/i);
	await descInput.fill('Renamed short description.');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/product') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	const savedRes = await saved;

	const body = JSON.parse(savedRes.request().postData() || '{}');
	expect(body.field).toBe('short_description');
	expect(body.value).toBe('Renamed short description.');
	await reloaded;

	await expect(productExcerptBlock(page)).toContainText(
		'Renamed short description.',
	);
});

test('product price save reloads and re-renders the new prices', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	await hoverAndOpenModal(page, productPriceBlock(page));

	const modal = dialog(page, /Edit price/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);

	const regular = modal.getByLabel(/Regular price/i);
	const sale = modal.getByLabel(/Sale price/i);
	await expect(regular).toHaveValue('30');
	await expect(sale).toHaveValue('20');

	await regular.fill('45');
	await sale.fill('35');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/product') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	const savedRes = await saved;

	// ProductPriceModal sends `{ regular, sale }` together — the
	// controller's `price` field expects the pair so derived _price
	// stays in sync.
	const body = JSON.parse(savedRes.request().postData() || '{}');
	expect(body.field).toBe('price');
	expect(body.value).toEqual({ regular: '45', sale: '35' });
	await reloaded;

	// woocommerce/product-price formats with the active currency; assert on
	// the numeric portion only — locale + currency symbol aren't our contract
	// to pin. The block re-renders the new price a beat after the load event,
	// so poll with an auto-retrying locator assertion (as the name +
	// short-description tests above do) — a one-shot innerText() snapshot races
	// the reload and catches the pre-save price.
	await expect(productPriceBlock(page)).toContainText('45');
	await expect(productPriceBlock(page)).toContainText('35');
});

// Opening the picker on a product:image used to
// lose the hover bar because hover-bar's isPickerType set only
// covered core/image / core/cover. `onEditClick` ran clearBar before
// setSelected even though InlineEditor still mounted the picker —
// dropdown floating with no anchoring QE pill above. The WC
// product-image block wraps its image in an anchor (`isLink` defaults
// to true), so the user's reproducible gesture is hover → click QE
// pill in the bar; both paths land in `onEditClick` and the bar
// teardown is the same shape.
test('opening the picker on a product image keeps the hover bar visible', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const image = productImageBlock(page);
	await image.scrollIntoViewIfNeeded();
	await image.hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await bar.getByRole('button', { name: /Quick Edit/ }).click();

	await expect(
		page.locator('#extendify-quick-edit-image-menu[role="menu"]'),
	).toBeVisible();
	await expect(hoverBar(page)).toBeVisible();
	await expect(
		hoverBar(page).getByRole('button', { name: /Quick Edit/ }),
	).toBeVisible();
});

test('product image hover bar opens wp.media frame in browse mode', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	// product:image routes through ImagePicker (PICKER_STRATEGIES), not
	// a modal — the Quick Edit pill opens the 4-option ImagePickerMenu
	// which in turn opens wp.media on each item.
	const image = productImageBlock(page);
	await image.scrollIntoViewIfNeeded();
	await image.hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await bar.getByRole('button', { name: /Quick Edit/ }).click();

	await page
		.getByRole('menuitem', { name: /Pick from media library/i })
		.click();

	// Match image-flows' frame-opens posture — don't drive the wp.media UI
	// itself. QE tags the opened frame (frame.modal.$el) with the mode class
	// on frame.on('open'); under WP-latest that lands on the inner media frame,
	// not body or the outer .media-modal, so assert the tag is applied.
	await expect(page.locator('.media-modal')).toBeVisible();
	await expect(
		page.locator('.extendify-quick-edit-mode-browse'),
	).toBeAttached();
});
