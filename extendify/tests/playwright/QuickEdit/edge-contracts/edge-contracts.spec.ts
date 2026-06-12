import { expect, test } from '../../fixtures';

// Characterization: the edge contracts that fall outside the four
// happy-path E2E specs. Each test pins one observable
// failure-mode or environment contract:
//
// 1. /quick-edit/save returns 500 → canvas-error surfaces, canvas stays
//    mounted, edited content stays in the editor for retry.
// 2. /api/draft/image is unreachable → AiImagePickerModal surfaces the
//    "Service temporarily unavailable" Notice, modal stays usable.
// 3. mobile viewport — the QE pill `<li>` is still registered by
//    Frontend.php (no viewport gate in the PHP), but WP's own
//    admin-bar CSS hides every secondary item behind the hamburger
//    menu at ≤ 600px. The pill node exists; it just isn't visible.
//    Pin both observables so a future PHP-side gate (or a WP CSS
//    change) shows up here.
// 4. RTL — `<html dir="rtl">` doesn't break the pill, the hover bar,
//    or BlockTextEditor mount. QE's CSS uses physical (left/right)
//    properties, not logical, so RTL doesn't reshape the bar — but the
//    pin guards against a future regression that would. Set after
//    navigation: WP rewrites the `<html>` open tag on render, so an
//    addInitScript attribute is dropped before the spec sees it.
// 5. agent cannot auto-enable Edit Mode — useEditModeStore has only two
//    writers in src/Agent/: Chat.jsx's Esc handler (`setOn(false)`) and
//    ChatTools' Select toggle (user click). Pin that the agent panel
//    mounting + a workflow-style `extendify-agent:cancel-workflow` event
//    don't flip edit mode on.

const HEADING_TEXT = 'Edge contracts heading.';

// QE still registers an admin-bar pill (no viewport gate), but the Simple
// Toolbar hides #wpadminbar on this branch, so the pill exists-but-hidden and
// can't be the readiness gate. Gate on the toolbar's #ext-tb-quick-edit switch.
const adminBarPill = (page) =>
	page.locator('#wp-admin-bar-extendify-quick-edit-toggle a');
const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const heading = (page) =>
	page.locator('h2.wp-block-heading', { hasText: HEADING_TEXT });

const imageBlock = (page) => page.locator('figure.wp-block-image').first();

const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();

const pickerMenu = (page) =>
	page.locator('#extendify-quick-edit-image-menu[role="menu"]');

const agentPanel = (page) => page.locator('#extendify-agent-popout-modal');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

// Edit mode seeds its default from launch-completed, and this blueprint marks
// Launch completed — so a test that needs the off state must set it explicitly.
const disableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: false }, version: 0 }),
		);
	});
};

const closeAgentPanel = async (page) => {
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:close')),
	);
	await expect(agentPanel(page)).toHaveCount(0);
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('save 500 surfaces the canvas error and keeps the editor open', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.route('**/quick-edit/save', (route) =>
		route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'mock server error' }),
		}),
	);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentPanel(page);

	await heading(page).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();

	const editor = editorRichText(page);
	await expect(editor).toBeVisible();
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially('Edge contracts heading edited.');

	const saveFailed = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 500,
	);
	await page.locator('[data-test="quick-edit-save"]').click();
	await saveFailed;

	// BlockTextEditor.handleSave catches the error, sets `saveError`, and
	// flips `saving` back off. friendlyMessage() (src/QuickEdit/lib/errors.js)
	// generalizes every non-nonce backend error to one copy, so the
	// canvas-error shows the generic string — not the raw `mock server error`
	// body. The canvas stays mounted so the user can edit and retry without
	// losing what they typed.
	await expect(
		page.locator('[data-test="quick-edit-canvas-error"]'),
	).toContainText(/Sorry, something went wrong/i);
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
	await expect(editor).toContainText('Edge contracts heading edited.');
	await expect(page.locator('[data-test="quick-edit-save"]')).toHaveText(
		/^Save$/,
	);

	// Live heading stays hidden behind the canvas (the live→canvas swap
	// stays in place) and the post body wasn't mutated — splice only fires
	// on a 2xx with rendered HTML.
	await expect(heading(page)).toHaveCSS('visibility', 'hidden');
});

test('AI host down surfaces an error Notice and keeps the modal open', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.route('**/api/draft/image', (route) =>
		route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'upstream timeout' }),
			headers: {
				'x-ratelimit-remaining': '9',
				'x-ratelimit-limit': '10',
				'x-ratelimit-reset': '0',
			},
		}),
	);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentPanel(page);

	await imageBlock(page).hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(pickerMenu(page)).toBeVisible();
	await pickerMenu(page)
		.getByRole('menuitem', { name: /Generate with AI/ })
		.click();

	const aiModal = page.locator('.extendify-quick-edit-ai-image');
	await expect(aiModal).toBeVisible();
	await aiModal.getByLabel(/Image prompt/i).fill('a hillside meadow at dusk');

	const failed = page.waitForResponse(
		(r) => r.url().includes('/api/draft/image') && r.status() === 503,
	);
	await aiModal.getByRole('button', { name: /^Generate$/ }).click();
	await failed;

	// generateImage throws `{ message: 'Service temporarily unavailable',
	// imageCredits }` on non-2xx; AiImagePickerModal renders that message
	// in a `Notice status="error"`, no preview is set, and the form stays
	// visible so the user can retry.
	await expect(aiModal.locator('.components-notice.is-error')).toContainText(
		/Service temporarily unavailable/i,
	);
	await expect(aiModal.locator('.extendify-quick-edit-ai-preview')).toHaveCount(
		0,
	);
	await expect(aiModal.getByLabel(/Image prompt/i)).toHaveValue(
		'a hillside meadow at dusk',
	);
});

test('the legacy QE admin-bar pill node still exists but stays hidden at mobile width', async ({
	page,
}) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/');

	// Frontend.php's registerAdminBar guards on `current_user_can('edit_posts')`
	// and `is_admin()` only — no viewport check — so the admin-bar pill node is
	// always in the DOM. On this branch the Simple Toolbar replaces the admin
	// bar and hides #wpadminbar (pill included) at every width; #ext-tb-quick-edit
	// is the live edit toggle. Pin that the legacy pill node still exists but is
	// hidden, so a future QE-side viewport gate (or a return to the WP admin bar)
	// shows up here.
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	const pill = adminBarPill(page);
	await expect(pill).toHaveCount(1);
	await expect(pill).toBeHidden();
});

test('hover bar still mounts on a heading when documentElement is dir=rtl', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	// WP rewrites the `<html>` open tag on render, so an `addInitScript`
	// dir attribute is clobbered before the spec sees it. Flip it after
	// navigation — QE's listeners read computed style + getBoundingClientRect,
	// neither of which is bound to first paint.
	await page.evaluate(() =>
		document.documentElement.setAttribute('dir', 'rtl'),
	);
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

	await heading(page).hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();

	// QE's hover bar uses absolute left/top positioning rather than logical
	// inset-inline-start/inset-block-start, so RTL does not mirror the bar.
	// Pin both observables (bar mounts, dir attribute survives) so a future
	// switch to logical properties has a regression baseline.
});

test('agent panel mounting + workflow-style events do not auto-enable Edit Mode', async ({
	page,
}) => {
	// Edit mode seeds its default from launch-completed (on in this blueprint),
	// so seed it OFF explicitly — the contract under test is that the agent
	// panel mounting and workflow-side events never FLIP edit mode on, not the
	// default value itself.
	await disableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await expect(agentPanel(page)).toBeVisible();

	await expect(editModeToggle(page)).toHaveAttribute('aria-checked', 'false');
	await expect(page.locator('html')).not.toHaveClass(/extendify-quick-edit-on/);

	// The only programmatic writer of `setOn(true)` is ChatTools' Select
	// chip (a user click). Agent workflows don't touch useEditModeStore.
	// Dispatch a representative workflow-side event that the chat layer
	// itself fires during normal operation and pin that edit mode stays off.
	await page.evaluate(() => {
		window.dispatchEvent(new CustomEvent('extendify-agent:cancel-workflow'));
		window.dispatchEvent(
			new CustomEvent('extendify-agent:remove-block-highlight'),
		);
	});

	await expect(page.locator('html')).not.toHaveClass(/extendify-quick-edit-on/);
	await expect(editModeToggle(page)).toHaveAttribute('aria-checked', 'false');
});
