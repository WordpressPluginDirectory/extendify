import { expect, test } from '../../fixtures';

// Characterization: Cmd+Z after a WC product save. Pins the
// `productReplay` branch of performUndo — ProductTextModal +
// ProductPriceModal stamp `beforeValue` into the undo entry, performUndo
// dispatches to saveProduct({ productId, field, value: entry.beforeValue }).
//
// Two tests cover both productReplay shapes — text fields carry a string
// `beforeValue`, price carries the `{ regular, sale }` pair so the
// controller's `price` field can keep derived `_price` in sync.

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

// The modal save reloads the page; QE must re-mount and re-bind its Cmd+Z
// handler before the undo press. mount() appends #extendify-quick-edit-root
// just before calling attachKeyboardUndo(), so that host is the post-reload
// readiness signal — on a starved runner the bundle can still be loading when
// the press would otherwise fire (root absent → no handler, undo no-ops).
const waitForQuickEditReady = (page) =>
	expect(page.locator('#extendify-quick-edit-root')).toBeAttached({
		timeout: 15_000,
	});

const productNameBlock = (page) =>
	page.locator('[data-extendify-quick-edit-product-field="name"]').first();

const productPriceBlock = (page) =>
	page.locator('[data-extendify-quick-edit-product-field="price"]').first();

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Cmd+Z after a product name save POSTs the original name back through /quick-edit/product and the title re-renders the original value', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	await hoverAndOpenModal(page, productNameBlock(page));

	const modal = dialog(page, /Edit product name/i);
	await waitForModalData(modal);
	const nameInput = modal.getByLabel(/Product name/i);
	await expect(nameInput).toHaveValue('Original Product Name');
	await nameInput.fill('Renamed via Quick Edit (undo)');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/product') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	await saved;
	await reloaded;

	await expect(productNameBlock(page)).toContainText(
		'Renamed via Quick Edit (undo)',
	);

	await waitForQuickEditReady(page);

	const undoSaved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/product') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const undoReloaded = page.waitForLoadState('load');
	await page.locator('body').press('ControlOrMeta+z');
	const undoRes = await undoSaved;
	const undoBody = JSON.parse(undoRes.request().postData() || '{}');
	expect(Number(undoBody.product_id)).toBeGreaterThan(0);
	expect(undoBody.field).toBe('name');
	expect(undoBody.value).toBe('Original Product Name');
	await undoReloaded;

	await expect(productNameBlock(page)).toContainText('Original Product Name');
	await expect(productNameBlock(page)).not.toContainText(
		'Renamed via Quick Edit (undo)',
	);
});

test('Cmd+Z after a product price save POSTs the original { regular, sale } pair back through /quick-edit/product and the rendered prices revert', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	await hoverAndOpenModal(page, productPriceBlock(page));

	const modal = dialog(page, /Edit price/i);
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
	await saved;
	await reloaded;

	// The product-price block re-renders a beat after the load event, so use
	// auto-retrying locator assertions — a one-shot innerText() snapshot races
	// the reload and catches the pre-save price (see wc-product.spec.ts).
	await expect(productPriceBlock(page)).toContainText('45');
	await expect(productPriceBlock(page)).toContainText('35');

	await waitForQuickEditReady(page);

	// ProductPriceModal stamps `beforeValue = { regular, sale }` so undo
	// restores both fields atomically — splitting into two saves would
	// leave _price out of sync mid-replay.
	const undoSaved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/product') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const undoReloaded = page.waitForLoadState('load');
	await page.locator('body').press('ControlOrMeta+z');
	const undoRes = await undoSaved;
	const undoBody = JSON.parse(undoRes.request().postData() || '{}');
	expect(Number(undoBody.product_id)).toBeGreaterThan(0);
	expect(undoBody.field).toBe('price');
	expect(undoBody.value).toEqual({ regular: '30', sale: '20' });
	await undoReloaded;

	await expect(productPriceBlock(page)).toContainText('30');
	await expect(productPriceBlock(page)).toContainText('20');
	await expect(productPriceBlock(page)).not.toContainText('45');
});
