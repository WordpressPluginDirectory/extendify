import { expect, test } from '../../fixtures';

// Characterization: Cmd+Z after a wpforms field save.
// WPFormsFieldModal stamps the inverse of its changes-bag into the undo
// entry; performUndo's `wpformsReplay` branch POSTs those originals back
// through /quick-edit/wpforms, which shallow-merges into the form's
// serialized JSON. The forward and reverse paths use the exact same
// endpoint shape — the controller doesn't distinguish "save" from "undo".

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

// The modal save reloads the page; QE must re-mount and re-bind its Cmd+Z
// handler before the undo press. mount() appends #extendify-quick-edit-root
// just before calling attachKeyboardUndo(), so that host is the post-reload
// readiness signal — on a starved runner the bundle can still be loading when
// the press would otherwise fire (root absent → no handler, undo no-ops).
const waitForQuickEditReady = (page) =>
	expect(page.locator('#extendify-quick-edit-root')).toBeAttached({
		timeout: 15_000,
	});

const nameFieldContainer = (page) =>
	page.locator('[data-extendify-quick-edit-wpform-field-id="1"]');

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Cmd+Z after a wpforms field save POSTs the original four props back through /quick-edit/wpforms and the rendered label + placeholder revert', async ({
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
	await waitForModalData(modal);
	await modal.getByLabel(/^Label$/i).fill('Renamed via Quick Edit (undo)');
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

	const renamedField = nameFieldContainer(page);
	await expect(renamedField).toBeVisible({ timeout: 15_000 });
	await expect(renamedField).toContainText('Renamed via Quick Edit (undo)');

	await waitForQuickEditReady(page);

	// WPFormsFieldModal stamps the inverse changes-bag — only the keys
	// touched on the forward save, paired with their pre-mutation values.
	const undoSaved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/wpforms') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	const undoReloaded = page.waitForLoadState('load');
	await page.locator('body').press('ControlOrMeta+z');
	const undoRes = await undoSaved;
	const undoBody = JSON.parse(undoRes.request().postData() || '{}');
	expect(undoBody.form_id).toBeGreaterThan(0);
	expect(undoBody.field_id).toBe(1);
	expect(undoBody.changes).toEqual({
		label: 'Original Name Label',
		placeholder: 'Original placeholder',
	});
	await undoReloaded;

	const restoredField = nameFieldContainer(page);
	await expect(restoredField).toBeVisible({ timeout: 15_000 });
	await expect(restoredField).toContainText('Original Name Label');
	await expect(restoredField.locator('input').first()).toHaveAttribute(
		'placeholder',
		'Original placeholder',
	);
});
