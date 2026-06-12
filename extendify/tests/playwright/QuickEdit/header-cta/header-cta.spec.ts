// Capstone for the header-CTA editing branch. The button + phone CTAs live in
// the header *template part*, so editing them end to end exercises the
// template-part load (resolveTarget PART_ATTR → TemplatePartBlockFinder), the
// save + in-place splice, the phone tel: href sync on save, and the link
// activation on open — the whole reason this branch exists — in a real browser.
// Template-part edits are site-wide, so the change must also show on a second
// URL (a single post), not just the page it was edited on.
//
// Tests run sequentially against one wp-playground server and the header part
// is shared, mutable state — so the read-only link-activation check runs first
// (before any edit), and the edit checks locate the button/phone generically
// (not by mutated text) so order can't break the locators.

import { expect, test } from '../../fixtures';

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');
const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');
const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();
const floatingBar = (page) =>
	page.locator('[data-test="quick-edit-floating-bar"]');
const saveButton = (page) => page.locator('[data-test="quick-edit-save"]');
const linkPopover = (page) => page.locator('.block-editor-link-control');
const urlInput = (page) =>
	page
		.locator(
			'.block-editor-link-control input[type="text"], .block-editor-url-input input',
		)
		.first();

const bannerButton = (page) =>
	page.getByRole('banner').locator('.wp-block-button__link');
const bannerPhone = (page) =>
	page
		.getByRole('banner')
		.locator('p.wp-block-paragraph')
		.filter({ has: page.locator('a[href^="tel:"]') });

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const gotoHome = async (page) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
};

const openInline = async (page, locator) => {
	await locator.scrollIntoViewIfNeeded();
	await locator.hover();
	await expect(hoverBar(page)).toBeVisible();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(editorRichText(page)).toBeVisible();
};

// ControlOrMeta + pressSequentially on the editor locator is the canonical
// canvas-edit gesture (see inline-text.spec.ts) — page.keyboard.type after a
// manual focus inserts each char at offset 0 and reverses the string.
const replaceText = async (page, text: string) => {
	const editor = editorRichText(page);
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially(text);
};

const saveInline = async (page) => {
	const saved = page.waitForResponse(
		(r) =>
			r.url().includes('/quick-edit/save') &&
			r.request().method() === 'POST' &&
			r.status() === 200,
	);
	await saveButton(page).click();
	await saved;
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('opening Quick Edit on the phone activates its link so the toolbar edits the existing link', async ({
	page,
}) => {
	await gotoHome(page);
	await openInline(page, bannerPhone(page));
	// The whole-link selection on open makes core/link active, so the toolbar
	// Link button reads as pressed — it edits the existing tel: link instead of
	// opening a blank "create link" (which is what a collapsed caret would do).
	await expect(
		floatingBar(page).getByRole('button', { name: /^Link$/, pressed: true }),
	).toBeVisible();
});

test('header button label edit persists across reload and shows site-wide', async ({
	page,
}) => {
	await gotoHome(page);
	await openInline(page, bannerButton(page));
	await replaceText(page, 'Buy Sofas');
	await saveInline(page);

	// Template-part text saves splice in place (no reload), so the live header
	// updates immediately…
	await expect(
		bannerButton(page).filter({ hasText: 'Buy Sofas' }),
	).toBeVisible();
	// …and the wp_template_part row persists the edit across a reload…
	await page.reload();
	await expect(
		bannerButton(page).filter({ hasText: 'Buy Sofas' }),
	).toBeVisible();
	// …and being a template part, it renders on every template, e.g. a post.
	await page.goto('/?p=1');
	await expect(
		bannerButton(page).filter({ hasText: 'Buy Sofas' }),
	).toBeVisible();
});

test('header phone digit edit persists and rewrites the tel: href on save', async ({
	page,
}) => {
	await gotoHome(page);
	await openInline(page, bannerPhone(page));
	// Insert digits INSIDE the existing tel: link (Home → step into the anchor →
	// type) so the anchor is preserved and Phase 3 rewrites the href to match the
	// new visible digits. A full select-all replace would drop the anchor — a
	// deliberate Phase 3 non-goal — so the edit is a mid-link insertion.
	const editor = editorRichText(page);
	await editor.press('Home');
	await editor.press('ArrowRight');
	await editor.pressSequentially('00');
	await saveInline(page);

	await page.reload();
	// "01 23 45 67 89" + "00" after the first digit → "0001 23 45 67 89"; the
	// href is the space-stripped digits.
	const phoneLink = page
		.getByRole('banner')
		.locator('a[href="tel:000123456789"]');
	await expect(phoneLink).toBeVisible();
	await expect(phoneLink).toHaveText('0001 23 45 67 89');
});

test('a link edit committed with Cmd/Ctrl+Return is applied, not discarded', async ({
	page,
}) => {
	await gotoHome(page);
	await openInline(page, bannerButton(page));
	const editor = editorRichText(page);
	await editor.press('ControlOrMeta+a');
	await editor.press('ControlOrMeta+k');
	await expect(linkPopover(page)).toBeVisible();

	await urlInput(page).fill('https://example.org/new');
	// While the link popover is focused, Cmd/Ctrl+Return must reach the popover
	// and apply the URL — not hijack the key to save the block with the stale
	// href and drop the edit. The popover transitions to its preview view.
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(linkPopover(page)).toContainText('example.org');
});
