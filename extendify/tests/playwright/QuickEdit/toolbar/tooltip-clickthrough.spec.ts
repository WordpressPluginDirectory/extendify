// QE bar tooltips hidden while a QE canvas is
// mounted. Many rounds of trying to place the tooltip nicely
// (pointer-events tricks, top placement, height equalization,
// Floating-UI-aware shifts) couldn't find a single rule that worked
// for both our 36px custom buttons (HeadingLevel / Color / TextAlign)
// AND the 48px BlockToolbar buttons (Bold / Italic / link) without
// either covering the trigger or sitting absurdly far from it. Tabled
// here per dev call ("remove the tooltips for now, revisit later").
//
// CSS scope `body:has(.extendify-quick-edit-floating-bar)` means only
// QE-session tooltips are hidden — AI Agent / WP admin chrome /
// other-plugin tooltips outside a QE edit session are untouched.
//
// Observable contract: while the QE canvas is mounted, hovering any
// QE bar button surfaces zero visible tooltip portals.

import { expect, test } from '../../fixtures';

const HEADING = 'A heading where toolbar tooltips can be hovered for a while.';

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const heading = (page) =>
	page.locator('h2.wp-block-heading', { hasText: HEADING });

const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();

const floatingBar = (page) =>
	page.locator('[data-test="quick-edit-floating-bar"]');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const openInlineEditor = async (page) => {
	await heading(page).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(editorRichText(page)).toBeVisible();
};

const visibleTooltipPortalCount = (page) =>
	page.evaluate(
		() =>
			Array.from(document.querySelectorAll('[id^="portal/tooltip"]')).filter(
				(el) => getComputedStyle(el).display !== 'none',
			).length,
	);

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('hovering any QE bar button does not surface a visible tooltip portal', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page);

	const labels = [
		'Bold',
		'Italic',
		'Heading level',
		'Text color',
		'Highlight color',
	];
	for (const label of labels) {
		const btn = floatingBar(page).getByRole('button', {
			name: new RegExp(`^${label}$`),
		});
		await expect(btn).toBeVisible();
		await btn.hover();
		await page.waitForTimeout(800);
		expect(
			await visibleTooltipPortalCount(page),
			`hovering "${label}" should not surface a visible tooltip`,
		).toBe(0);
	}
});
