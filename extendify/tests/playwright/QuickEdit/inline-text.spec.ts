import { expect, test } from '../fixtures';

// Characterization: the primary inline-text journey for the rebuild's
// schema-driven editor. Each test pins one observable step from the
// user's perspective: admin pill → hover bar → BlockTextEditor mount →
// Save / Cmd+Enter / Esc / Cmd+Z. Headings drive the journey because
// the seed page leads with several h2s; the trailing paragraph pins
// that paragraphs now also resolve and get both pills (detectBlockType
// derives core/<X> from any wp-block-X class).
//
// The "Editor-role user → no admin-bar pill" coverage item
// is intentionally omitted: the EditModeLifecycleTest already pinned
// the gate at `current_user_can('edit_posts')`, which Editor users have.
// Replaying that gate in E2E would add no signal beyond what PHPUnit
// already characterizes.

const HEADING_1_ORIGINAL = 'First heading for inline-text testing.';
const HEADING_1_EDITED = 'First heading edited via Save click.';
const HEADING_2_ORIGINAL = 'Second heading for cancel testing.';
const HEADING_3_ORIGINAL = 'Third heading for cmd-enter testing.';
const HEADING_3_EDITED = 'Third heading edited via Cmd+Enter.';
const HEADING_4_ORIGINAL = 'Fourth heading for undo testing.';
const HEADING_4_EDITED = 'Fourth heading edited then undone.';
const PARAGRAPH_TEXT = 'Paragraphs only get Ask AI today, not Quick Edit.';

// Simple-toolbar replaces the WP admin bar on the live front end
// (Toolbar/Frontend.php hides `#wpadminbar`); its `#ext-tb-quick-edit`
// button is the user-facing Edit mode toggle.
const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();

const heading = (page, text: string) =>
	page.locator('h2.wp-block-heading', { hasText: text });

const paragraph = (page, text: string) =>
	page.locator('p.wp-block-paragraph', { hasText: text });

// Seeds edit-mode-on via the persist key so the hover bar's mouseover
// listener is wired by the time the spec hovers. Doing it through the
// pill works too but adds a click + an extra wait for the subscribe to
// propagate to the listener wiring in quick-edit.jsx.
const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

// Edit mode now seeds its default from launch-completed, and this blueprint
// marks Launch completed — so the off-then-toggle-on test must set the off
// state explicitly rather than relying on the absence of persisted state.
const disableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: false }, version: 0 }),
		);
	});
};

const markPageForReloadDetection = async (page) => {
	await page.evaluate(() => {
		(window as unknown as { __qeNoReload: boolean }).__qeNoReload = true;
	});
};

const pageDidNotReload = async (page) =>
	page.evaluate(
		() =>
			(window as unknown as { __qeNoReload?: boolean }).__qeNoReload === true,
	);

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('admin sees the Edit mode toggle and toggling it does not reload the page', async ({
	page,
}) => {
	await disableEditMode(page);
	await page.goto('/');

	const toggle = editModeToggle(page);
	await expect(toggle).toBeVisible({ timeout: 15_000 });
	await expect(toggle).toHaveAttribute('aria-checked', 'false');

	await markPageForReloadDetection(page);
	await toggle.click();

	await expect(toggle).toHaveAttribute('aria-checked', 'true');
	await expect(page.locator('html')).toHaveClass(/extendify-quick-edit-on/);
	expect(await pageDidNotReload(page)).toBe(true);
});

test('hovering a heading in Edit mode shows the hover bar with Quick Edit + Ask AI pills', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const target = heading(page, HEADING_1_ORIGINAL);
	await expect(target).toBeVisible();
	await target.hover();

	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();
	await expect(
		page.locator('.extendify-quick-edit-hover-outline.is-visible'),
	).toBeVisible();
});

test('hovering a paragraph in Edit mode surfaces both Ask AI and Quick Edit pills', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const para = paragraph(page, PARAGRAPH_TEXT);
	await expect(para).toBeVisible();
	await para.hover();

	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();
});

test('clicking Quick Edit mounts the BlockTextEditor and focuses the rich-text input', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	await heading(page, HEADING_1_ORIGINAL).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const editor = editorRichText(page);
	await expect(editor).toBeVisible();
	await expect(editor).toBeFocused();
});

test('Save persists the edit in-place and does not reload the page', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await markPageForReloadDetection(page);

	await heading(page, HEADING_1_ORIGINAL).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const editor = editorRichText(page);
	await expect(editor).toBeVisible();
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially(HEADING_1_EDITED);

	const saved = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);
	await page.locator('[data-test="quick-edit-save"]').click();
	await saved;

	await expect(heading(page, HEADING_1_EDITED)).toBeVisible();
	expect(await pageDidNotReload(page)).toBe(true);
});

test('Cmd+Enter persists the edit in-place and does not reload the page', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await markPageForReloadDetection(page);

	await heading(page, HEADING_3_ORIGINAL).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const editor = editorRichText(page);
	await expect(editor).toBeVisible();
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially(HEADING_3_EDITED);

	const saved = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);
	await editor.press('ControlOrMeta+Enter');
	await saved;

	await expect(heading(page, HEADING_3_EDITED)).toBeVisible();
	expect(await pageDidNotReload(page)).toBe(true);
});

test('Esc tears down the editor without saving', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');

	await heading(page, HEADING_2_ORIGINAL).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const editor = editorRichText(page);
	await expect(editor).toBeVisible();
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially('Throwaway text never committed');

	let saveFired = false;
	page.on('response', (r) => {
		if (r.url().includes('/quick-edit/save')) saveFired = true;
	});

	await editor.press('Escape');

	await expect(page.locator('.extendify-quick-edit-canvas')).not.toBeVisible();
	await expect(heading(page, HEADING_2_ORIGINAL)).toBeVisible();
	expect(saveFired).toBe(false);
});

test('Cmd+Z replays the prior save and the live DOM reverts after the reload', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	await heading(page, HEADING_4_ORIGINAL).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const editor = editorRichText(page);
	await expect(editor).toBeVisible();
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially(HEADING_4_EDITED);

	const saved = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);
	await page.locator('[data-test="quick-edit-save"]').click();
	await saved;

	await expect(heading(page, HEADING_4_EDITED)).toBeVisible();

	// undo replays the pre-edit body through /quick-edit/save and then
	// reloads the page (state/undo.js' window.location.reload), so the
	// assertion lives on the post-reload DOM.
	const undoSaved = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);
	const reloaded = page.waitForLoadState('load');
	await page.locator('body').press('ControlOrMeta+z');
	await undoSaved;
	await reloaded;

	await expect(heading(page, HEADING_4_ORIGINAL)).toBeVisible();
	await expect(heading(page, HEADING_4_EDITED)).toHaveCount(0);
});
