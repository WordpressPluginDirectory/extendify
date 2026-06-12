import { expect, test } from '../../fixtures';

// The image picker menu must be operable by keyboard.
// Enter on a tagged image already opens the four-item menu; this spec
// pins the menu's keyboard contract: focus lands on the first item,
// Arrow/Home/End rove between items, Enter activates, and Esc returns
// focus to the image. The Upload → wp.media path is deliberately avoided
// (wp.media is flaky in playground); keyboard activation is
// asserted via the React "Generate with AI" modal instead.

// TagBlocks tags the first start tag of the rendered block, so the
// <figure> itself carries the id and (in edit mode) tabindex="0".
const imageBlock = (page) =>
	page.locator('figure.wp-block-image[data-extendify-agent-block-id]');

const pickerMenu = (page) =>
	page.locator('#extendify-quick-edit-image-menu[role="menu"]');

const menuItems = (page) => pickerMenu(page).getByRole('menuitem');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const openMenuViaKeyboard = async (page) => {
	const fig = imageBlock(page);
	// Edit mode decorates tagged blocks with tabindex=0. Waiting for it is
	// also the readiness gate: it confirms the Quick Edit bundle mounted and
	// keyboard entry attached, so the focus + Enter below reach the handler.
	await expect(fig).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await fig.focus();
	await page.keyboard.press('Enter');
	await expect(pickerMenu(page)).toBeVisible();
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('keyboard opens the picker, roves the items, and Esc returns focus to the image', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	await openMenuViaKeyboard(page);

	const items = menuItems(page);
	await expect(items).toHaveCount(4);

	// Focus lands on the first item when the menu opens.
	await expect(items.nth(0)).toBeFocused();

	// ArrowDown advances and wraps from last → first.
	await page.keyboard.press('ArrowDown');
	await expect(items.nth(1)).toBeFocused();
	await page.keyboard.press('End');
	await expect(items.nth(3)).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(items.nth(0)).toBeFocused();

	// ArrowUp wraps from first → last; Home jumps back to first.
	await page.keyboard.press('ArrowUp');
	await expect(items.nth(3)).toBeFocused();
	await page.keyboard.press('Home');
	await expect(items.nth(0)).toBeFocused();

	// Esc closes the menu and returns focus to the image.
	await page.keyboard.press('Escape');
	await expect(pickerMenu(page)).toHaveCount(0);
	await expect(imageBlock(page)).toBeFocused();
});

test('keyboard Enter on a roved-to item activates it', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');

	await openMenuViaKeyboard(page);

	// ArrowDown twice lands on "Generate with AI" (third item); Enter
	// activates it (native button behavior) and opens the AI modal.
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await expect(menuItems(page).nth(2)).toBeFocused();
	await page.keyboard.press('Enter');

	await expect(page.locator('.extendify-quick-edit-ai-image')).toBeVisible();
});
