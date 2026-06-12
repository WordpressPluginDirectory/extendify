import { expect, test } from '../../fixtures';

// Characterization: editing a WPForms field through Quick Edit's modal.
// WPFormsTagger marks the rendered <form> with
// data-extendify-quick-edit-wpform-id and each field container with
// -wpform-field-id; the modal POSTs to /quick-edit/wpforms with a
// changes-bag that the controller shallow-merges into the stored form
// JSON. The contract the spec pins:
//
//   1. The field's hover bar surfaces a Quick Edit pill (Ask AI is gated
//      off — the wpforms `source.kind` is not 'post' or null).
//   2. The modal pre-fills from the stored field's label / placeholder /
//      description / required.
//   3. Save → reload → the new values render in the live form.
//   4. The untouched `select` field still surfaces both choices on
//      reload — choices / validation are not part of the changes-bag and
//      must survive the round-trip.

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

const nameFieldContainer = (page) =>
	page.locator('[data-extendify-quick-edit-wpform-field-id="1"]');

const selectFieldContainer = (page) =>
	page.locator('[data-extendify-quick-edit-wpform-field-id="2"]');

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('WPForms field hover surfaces only the Quick Edit pill', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const field = nameFieldContainer(page);
	await expect(field).toBeVisible({ timeout: 15_000 });
	await field.scrollIntoViewIfNeeded();
	// WPForms wraps fields in a `.wpforms-field-container` that the
	// Playwright actionability check sees as the topmost element when
	// hovering a child .wpforms-field. dispatchEvent fires the real DOM
	// mouseover event the hover-bar listens for on document and skips
	// the actionability check entirely.
	await field.dispatchEvent('mouseover');

	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toHaveCount(0);
});

test('WPFormsFieldModal pre-fills from stored field values', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const field = nameFieldContainer(page);
	await expect(field).toBeVisible({ timeout: 15_000 });
	await field.scrollIntoViewIfNeeded();
	// WPForms wraps fields in a `.wpforms-field-container` that the
	// Playwright actionability check sees as the topmost element when
	// hovering a child .wpforms-field. dispatchEvent fires the real DOM
	// mouseover event the hover-bar listens for on document and skips
	// the actionability check entirely.
	await field.dispatchEvent('mouseover');
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const modal = dialog(page, /Edit form field/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);

	await expect(modal.getByLabel(/^Label$/i)).toHaveValue('Original Name Label');
	await expect(modal.getByLabel(/^Placeholder$/i)).toHaveValue(
		'Original placeholder',
	);
	await expect(modal.getByLabel(/^Description/i)).toHaveValue(
		'Original description',
	);
	await expect(modal.getByLabel(/Required field/i)).toBeChecked();
});

test('saving field changes reloads and the new label / placeholder render', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const field = nameFieldContainer(page);
	await field.scrollIntoViewIfNeeded();
	// WPForms wraps fields in a `.wpforms-field-container` that the
	// Playwright actionability check sees as the topmost element when
	// hovering a child .wpforms-field. dispatchEvent fires the real DOM
	// mouseover event the hover-bar listens for on document and skips
	// the actionability check entirely.
	await field.dispatchEvent('mouseover');
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const modal = dialog(page, /Edit form field/i);
	await expect(modal).toBeVisible();
	await waitForModalData(modal);

	await modal.getByLabel(/^Label$/i).fill('Renamed Label');
	await modal.getByLabel(/^Placeholder$/i).fill('Renamed placeholder');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/wpforms') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	await saved;
	await reloaded;

	const reloadedField = nameFieldContainer(page);
	await expect(reloadedField).toBeVisible({ timeout: 15_000 });
	await expect(reloadedField).toContainText('Renamed Label');
	await expect(reloadedField.locator('input').first()).toHaveAttribute(
		'placeholder',
		'Renamed placeholder',
	);
});

test('saving a field does not clobber the untouched select field choices', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });

	const field = nameFieldContainer(page);
	await field.scrollIntoViewIfNeeded();
	// WPForms wraps fields in a `.wpforms-field-container` that the
	// Playwright actionability check sees as the topmost element when
	// hovering a child .wpforms-field. dispatchEvent fires the real DOM
	// mouseover event the hover-bar listens for on document and skips
	// the actionability check entirely.
	await field.dispatchEvent('mouseover');
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const modal = dialog(page, /Edit form field/i);
	await waitForModalData(modal);
	await modal.getByLabel(/^Label$/i).fill('Round-tripped Label');

	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/wpforms') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await modal.getByRole('button', { name: /^Save$/ }).click();
	await saved;
	await reloaded;

	const select = selectFieldContainer(page).locator('select').first();
	await expect(select).toBeVisible({ timeout: 15_000 });
	await expect(select.locator('option')).toContainText(['Email', 'Phone']);
});
