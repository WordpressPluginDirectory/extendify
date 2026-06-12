// Text-alignment dropdown on the QE
// floating bar. Gutenberg ships alignment in a BlockControls group the
// QE bar hides; the QE-side dropdown restores it for blocks whose render
// path applies `has-text-align-*` from `style.typography.textAlign` via
// useBlockProps (`core/heading`, `core/paragraph`).
//
// An earlier design had three inline buttons whose wider tooltips overlapped
// neighbouring toolbar buttons. Collapsing to a single trigger
// + popover and trying `Tooltip placement="top"` didn't escape the overlap —
// the placement-top tooltip still overlapped in real-WP testing because
// "Align text" is wider than the 36px icon-only trigger. So the trigger
// tooltip is dropped entirely — the popover's visible option
// labels carry the affordance once opened. The pin below asserts no
// `.components-tooltip` ever appears on hover of the trigger so the
// regression can't return.

import { expect, test } from '../../fixtures';

const PARAGRAPH = 'A plain paragraph that can take a text alignment.';
const HEADING = 'A heading that can take a text alignment.';

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const paragraph = (page) =>
	page.locator('p.wp-block-paragraph', { hasText: PARAGRAPH });

const heading = (page) =>
	page.locator('h2.wp-block-heading', { hasText: HEADING });

const image = (page) => page.locator('figure.wp-block-image').first();

const buttonBlock = (page) =>
	page.locator('div.wp-block-button', { hasText: 'Browse Collection' });

const colorsGroup = (page) =>
	floatingBar(page).locator('[data-test="quick-edit-colors-group"]');

const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();

const floatingBar = (page) =>
	page.locator('[data-test="quick-edit-floating-bar"]');

const alignTrigger = (page) =>
	floatingBar(page).locator('.extendify-quick-edit-text-align-button');

const alignPopover = (page) =>
	page.locator('.extendify-quick-edit-text-align-popover');

const alignOption = (page, name: RegExp) =>
	alignPopover(page).getByRole('option', { name });

const headingLevelButton = (page) =>
	floatingBar(page).locator('.extendify-quick-edit-heading-level-button');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const openInlineEditor = async (page, target) => {
	await target.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(editorRichText(page)).toBeVisible();
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('paragraph: opening the dropdown and picking center applies has-text-align-center and persists on save', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, paragraph(page));
	await expect(alignTrigger(page)).toBeVisible();

	await alignTrigger(page).click();
	await expect(alignPopover(page)).toBeVisible();
	await alignOption(page, /^Align text center$/).click();
	await expect(alignPopover(page)).toBeHidden();
	await expect(editorRichText(page)).toHaveClass(/has-text-align-center/);

	const saved = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);
	await page.locator('[data-test="quick-edit-save"]').click();
	await saved;

	await expect(editorRichText(page)).toBeHidden();
	await expect(paragraph(page)).toHaveClass(/has-text-align-center/);
});

test('heading: picking left then right swaps the alignment in place', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, heading(page));

	await alignTrigger(page).click();
	await alignOption(page, /^Align text left$/).click();
	await expect(editorRichText(page)).toHaveClass(/has-text-align-left/);

	await alignTrigger(page).click();
	await alignOption(page, /^Align text right$/).click();
	await expect(editorRichText(page)).toHaveClass(/has-text-align-right/);
	await expect(editorRichText(page)).not.toHaveClass(/has-text-align-left/);
});

test('image: alignment trigger is not rendered (block has no textAlign attribute)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await image(page).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	await expect(alignTrigger(page)).toHaveCount(0);
});

test('button block: alignment trigger + colors group are NOT rendered', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, buttonBlock(page));

	// Buttons are controlled by global styles, not inline alignment /
	// text-color / highlight — the QE bar drops those groups for
	// `core/button`.
	await expect(alignTrigger(page)).toHaveCount(0);
	await expect(colorsGroup(page)).toHaveCount(0);

	// BlockToolbar's B / I / link are still lifted in, so editing the
	// button's text works.
	await expect(
		floatingBar(page).getByRole('button', { name: /^Bold$/ }),
	).toBeVisible();
});

test('hovering the alignment trigger does not surface a tooltip while the QE bar is mounted', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, heading(page));

	// QE bar tooltips are hidden globally (revisit later).
	// The other half of the contract — that tooltips return when the bar
	// unmounts — is the scope guarantee of `body:has(.extendify-quick-edit-
	// floating-bar)` in quick-edit.css.
	await headingLevelButton(page).hover();
	await page.waitForTimeout(400);
	await alignTrigger(page).hover();
	await page.waitForTimeout(800);

	const visible = await page.evaluate(
		() =>
			Array.from(document.querySelectorAll('[id^="portal/tooltip"]')).filter(
				(el) => getComputedStyle(el).display !== 'none',
			).length,
	);
	expect(visible).toBe(0);
});
