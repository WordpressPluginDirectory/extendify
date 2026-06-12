// The LinkControl popover inside the Quick Edit canvas. The
// reported bug: "hard to click where intended; edit box reads as too
// short." Root cause is positioning, not pointer-events. WP's Popover
// computes the anchor's viewport rect via getBoundingClientRect and
// writes the result to style.top/left. The popover renders inside
// BlockTools' Popover.Slot, which lives inside our canvas, which is
// portaled into `.extendify-quick-edit-host` (position: absolute). With
// absolute positioning, the viewport-coordinate `style.top/left` is
// interpreted relative to `host`, not the viewport — so the popover
// drifts by host.top/left and gets constrained by canvas width.
//
// These specs assert what "fixed" looks like: popover lands inside the
// viewport, the URL input is at least its natural ~250px wide, and the
// user can type into it. Paragraph + button block both go through the
// same BlockTextEditor + BlockToolbar path.

import { expect, test } from '../../fixtures';

const PARAGRAPH_TEXT = 'Edit the link inside this paragraph for testing.';
const BUTTON_TEXT = 'Open my long button link';
const URL_TO_TYPE = 'https://example.org';

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const paragraph = (page) =>
	page.locator('p.wp-block-paragraph', { hasText: PARAGRAPH_TEXT });

const button = (page) =>
	page.locator('.wp-block-button__link', { hasText: BUTTON_TEXT });

const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();

const linkButton = (page) =>
	page
		.locator('[data-test="quick-edit-floating-bar"]')
		.getByRole('button', { name: /^Link$/ });

const linkPopover = (page) => page.locator('.block-editor-link-control');

const urlInput = (page) =>
	page
		.locator(
			'.block-editor-link-control input[type="text"], .block-editor-url-input input',
		)
		.first();

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const openInlineEditor = async (page, locator) => {
	await locator.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(editorRichText(page)).toBeVisible();
};

const selectAllInEditor = async (page) => {
	const editable = editorRichText(page);
	// The floating toolbar can overlap a short live element (button blocks
	// especially) — `focus()` sidesteps the hit-test that `.click()` does.
	await editable.evaluate((el: HTMLElement) => el.focus());
	const platform = await page.evaluate(() => navigator.platform);
	const modifier = /Mac/.test(platform) ? 'Meta' : 'Control';
	await page.keyboard.press(`${modifier}+a`);
};

const openLinkPopover = async (page) => {
	await linkButton(page).click();
	await expect(linkPopover(page)).toBeVisible();
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('paragraph LinkControl popover lands inside the viewport', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, paragraph(page));
	await selectAllInEditor(page);
	await openLinkPopover(page);

	const box = await linkPopover(page).boundingBox();
	const vp = page.viewportSize();
	expect(box).not.toBeNull();
	if (!box || !vp) throw new Error('no box');
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
});

test('paragraph LinkControl URL input has enough room to type', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, paragraph(page));
	await selectAllInEditor(page);
	await openLinkPopover(page);

	const input = urlInput(page);
	await expect(input).toBeVisible();
	const box = await input.boundingBox();
	expect(box?.width ?? 0).toBeGreaterThanOrEqual(200);

	// Real click — not just .fill — exercises the click contract end to
	// end. The repro is "cursor reads as crosshair
	// over the URL input; clicking does nothing." If the capture-phase
	// click handler hijacks the click, the input never focuses and
	// .toBeFocused() fails — exactly the symptom this guards against.
	await input.click();
	await expect(input).toBeFocused();
	// I-beam cursor on the input. The CSS that scopes
	// form-control cursor reverts to UA default by ancestor; the
	// link-popover-specific rule pins it to `text` regardless
	// of which tagged ancestor the popover ends up portaled into.
	await expect(input).toHaveCSS('cursor', 'text');

	await input.fill(URL_TO_TYPE);
	await expect(input).toHaveValue(URL_TO_TYPE);
});

// The CSS class(es) row is developer-only noise; the drawer's other two
// settings (new tab, nofollow) must survive the hide.
test('link popover Advanced drawer hides the CSS class(es) setting', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, paragraph(page));
	await selectAllInEditor(page);
	await openLinkPopover(page);

	// The drawer only renders when editing an applied link — commit one
	// first, then reopen the edit view.
	await urlInput(page).fill(URL_TO_TYPE);
	await urlInput(page).press('Enter');
	await expect(linkPopover(page)).toContainText('example.org');
	await linkPopover(page).getByRole('button', { name: /Edit/ }).first().click();

	await linkPopover(page)
		.getByRole('button', { name: /^Advanced$/ })
		.click();

	const settings = linkPopover(page).locator(
		'.block-editor-link-control__settings',
	);
	await expect(settings.getByLabel(/Open in new tab/)).toBeVisible();
	await expect(settings.getByLabel(/Mark as nofollow/)).toBeVisible();
	await expect(settings.getByLabel(/Additional CSS class/)).toBeHidden();
});

test('button block toolbar lists its action buttons', async ({ page }) => {
	// Light smoke for the button-block path: Quick Edit on a button used to
	// crash before the schema-driven rebuild; keep that path from silently
	// regressing.
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, button(page));
	const bar = page.locator('[data-test="quick-edit-floating-bar"]');
	await expect(bar).toBeVisible();
	await expect(
		bar.getByRole('button', { name: /Cancel|Save/ }).first(),
	).toBeVisible();
});

// Button-block LinkControl coverage. Cmd/Ctrl+K is RichText's native link
// shortcut — it opens the same LinkControl popover as the toolbar Link
// button without going through the floating bar that overlaps a short
// button's rich-text and intercepts clicks. Same CSS fix applies (forcing
// `position: fixed` on .components-popover descendants of the
// canvas); these pin the same contract from the button-block surface.
test('button-block LinkControl popover lands inside the viewport', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, button(page));
	await selectAllInEditor(page);
	const platform = await page.evaluate(() => navigator.platform);
	const modifier = /Mac/.test(platform) ? 'Meta' : 'Control';
	await page.keyboard.press(`${modifier}+k`);
	await expect(linkPopover(page)).toBeVisible();

	const box = await linkPopover(page).boundingBox();
	const vp = page.viewportSize();
	expect(box).not.toBeNull();
	if (!box || !vp) throw new Error('no box');
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
});

test('button-block LinkControl URL input has enough room to type', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, button(page));
	await selectAllInEditor(page);
	const platform = await page.evaluate(() => navigator.platform);
	const modifier = /Mac/.test(platform) ? 'Meta' : 'Control';
	await page.keyboard.press(`${modifier}+k`);
	await expect(linkPopover(page)).toBeVisible();

	const input = urlInput(page);
	await expect(input).toBeVisible();
	const box = await input.boundingBox();
	expect(box?.width ?? 0).toBeGreaterThanOrEqual(200);

	// Real click — not just .fill — pins the contract:
	// click focuses the URL input, cursor reads as text (I-beam) not
	// crosshair. Symmetric to the paragraph spec above.
	await input.click();
	await expect(input).toBeFocused();
	await expect(input).toHaveCSS('cursor', 'text');

	await input.fill(URL_TO_TYPE);
	await expect(input).toHaveValue(URL_TO_TYPE);
});

// Without a positioned wrapper on the body-level slot, the popover ignores
// the admin bar's html margin and covers the button label. Pin the geometry.
test('button-block LinkControl popover does not cover the button it edits', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, button(page));
	await selectAllInEditor(page);
	const platform = await page.evaluate(() => navigator.platform);
	const modifier = /Mac/.test(platform) ? 'Meta' : 'Control';
	await page.keyboard.press(`${modifier}+k`);
	await expect(linkPopover(page)).toBeVisible();

	// The live button hides while editing; the QE host overlays its exact rect.
	const hostBox = await page
		.locator('[data-test="quick-edit-host"]')
		.boundingBox();
	const popBox = await linkPopover(page).boundingBox();
	if (!hostBox || !popBox) throw new Error('no box');
	const verticalOverlap =
		Math.min(popBox.y + popBox.height, hostBox.y + hostBox.height) -
		Math.max(popBox.y, hostBox.y);
	// ≤4px allows the shift middleware's viewport padding, not a real overlap.
	expect(verticalOverlap).toBeLessThanOrEqual(4);
});

// Hover affordance on the LinkControl preview view. After
// applying a link, the popover transitions to a preview with the URL
// as a clickable anchor plus three action buttons (Edit / Unlink /
// Copy). An earlier broad `cursor: revert` reverted these buttons to
// the UA default arrow, and Extendable's `a:hover` faded the URL text
// too light to read. This pins pointer + readable foreground; this
// test guards both contracts on the button block.
test('button-block LinkControl preview affordances — pointer cursor + readable URL', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, button(page));
	await selectAllInEditor(page);
	const platform = await page.evaluate(() => navigator.platform);
	const modifier = /Mac/.test(platform) ? 'Meta' : 'Control';
	await page.keyboard.press(`${modifier}+k`);
	await expect(linkPopover(page)).toBeVisible();

	await urlInput(page).fill(URL_TO_TYPE);
	await linkPopover(page)
		.getByRole('button', { name: /^Apply$/ })
		.click();
	await expect(linkPopover(page)).toContainText('example.org');

	const previewLink = linkPopover(page)
		.locator('.block-editor-link-control__preview-title')
		.first();
	await expect(previewLink).toBeVisible();
	await expect(previewLink).toHaveCSS('cursor', 'pointer');
	await previewLink.hover();
	await expect(previewLink).toHaveCSS('color', 'rgb(30, 30, 30)');

	for (const name of [/Edit/, /Unlink|Remove/, /Copy/]) {
		const action = linkPopover(page).getByRole('button', { name }).first();
		await expect(action).toBeVisible();
		await expect(action).toHaveCSS('cursor', 'pointer');
	}
});

// "Cursor reads as crosshair over the
// link input; clicking freezes the modal." The fix dropped the
// agent-lock `pointer-events: none` rules that were the likely cause.
// Pin the user-observable contract end-to-end on the button block:
// click the URL input, type, click Apply, the link commits.
test('button-block LinkControl Apply commits the link without freezing', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, button(page));
	await selectAllInEditor(page);
	const platform = await page.evaluate(() => navigator.platform);
	const modifier = /Mac/.test(platform) ? 'Meta' : 'Control';
	await page.keyboard.press(`${modifier}+k`);
	await expect(linkPopover(page)).toBeVisible();

	const input = urlInput(page);
	// Replace the seeded `https://example.com` value with the test URL.
	// The "freeze" symptom is the popover going unresponsive
	// after a click — exercised end-to-end below by clicking Apply and
	// asserting the commit lands.
	await input.fill(URL_TO_TYPE);
	await expect(input).toHaveValue(URL_TO_TYPE);

	// LinkControl's submit button is "Apply" in WP 6.x. Click it; the
	// popover transitions to a preview view showing the saved URL —
	// proof the modal isn't frozen and the commit fired through.
	await linkPopover(page)
		.getByRole('button', { name: /^Apply$/ })
		.click();

	// Apply collapses the input form and renders the saved URL as a
	// preview link. The "https://" prefix is dropped in display, so
	// match on the host instead.
	await expect(linkPopover(page)).toContainText('example.org');
});
