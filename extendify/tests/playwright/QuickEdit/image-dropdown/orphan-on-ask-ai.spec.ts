import { expect, test } from '../../fixtures';

// Clicking Ask AI while QE's image-source dropdown is
// open must dismiss the dropdown alongside the bar. The dropdown is
// owned by InlineEditor (driven by `selected`); the prior onAiClick
// cleared the bar + committedSelection but never cleared `selected`,
// leaving the ImagePicker mounted as an orphan menu floating over the
// image with no anchor.

// Simple-toolbar replaces the WP admin bar on the live front end
// (Toolbar/Frontend.php hides `#wpadminbar`); its `#ext-tb-quick-edit`
// button is the user-facing Edit mode toggle.
const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const imageBlock = (page) => page.locator('figure.wp-block-image').first();

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

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Ask AI pill closes the QE image picker dropdown', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await imageBlock(page).hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();

	await bar.getByRole('button', { name: /Quick Edit/ }).click();
	await expect(pickerMenu(page)).toBeVisible();

	// The bar stays mounted for picker-type blocks so the dropdown can
	// anchor to it; Ask AI is still reachable while the menu is open.
	// Clicking it must tear down BOTH surfaces — the bar (via clearBar)
	// and the dropdown (via clearSelected, since InlineEditor's
	// ImagePicker is bound to `selected`).
	await bar.getByRole('button', { name: /Ask AI/ }).click();

	await expect(pickerMenu(page)).toHaveCount(0);
	await expect(hoverBar(page)).toHaveCount(0);
	await expect(agentPanel(page)).toBeVisible();
});

// Picker-type two-pill blocks are exempt from the
// silent agent stage that two-pill text blocks get when the agent
// sidebar is open. Clicking the image's Quick Edit pill must surface
// only the picker dropdown — not the picker AND the agent's
// DOMHighlighter X-close indicator at once. The user escalates to the
// agent explicitly by clicking the Ask AI pill (which stays alive on
// the bar for picker types).
test('image + agent open: Quick Edit click shows picker without agent staging', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await expect(agentPanel(page)).toBeVisible();

	await imageBlock(page).hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await bar.getByRole('button', { name: /Quick Edit/ }).click();

	await expect(pickerMenu(page)).toBeVisible();
	// X-close mounts inside #extendify-agent-dom-mount whenever agentBlock
	// is non-null; its absence is the visible signal that the click did
	// NOT stage the image for the agent.
	await expect(
		page.locator('#extendify-agent-dom-mount div[role="button"]'),
	).toHaveCount(0);
});
