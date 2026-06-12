import { expect, test } from '../../fixtures';

// Clicking a different tagged image while QE's
// image-source dropdown is open on image A must move (not duplicate)
// the dropdown to image B. Pre-fix the `ImagePicker` instance was
// reused across `selected` changes, so `ImagePickerMenu`'s position —
// computed once from `useState(compute)` — stayed pinned to A's rect
// even after `selected.el` flipped to B. Visible as an orphan-looking
// menu floating where A used to be while B has its own hover bar.

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const imageBlock = (page, idx: number) =>
	page.locator('figure.wp-block-image').nth(idx);

const pickerMenu = (page) =>
	page.locator('#extendify-quick-edit-image-menu[role="menu"]');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const closeAgentSidebar = async (page) => {
	const closeBtn = page
		.locator('#extendify-agent-popout-modal')
		.getByRole('button', { name: 'Close window' });
	if (await closeBtn.isVisible()) await closeBtn.click();
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('cross-image click moves the picker dropdown to the new image', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentSidebar(page);

	const imageA = imageBlock(page, 0);
	const imageB = imageBlock(page, 1);
	await expect(imageA).toBeVisible();
	await expect(imageB).toBeVisible();

	await imageA.hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await bar.getByRole('button', { name: /Quick Edit/ }).click();

	await expect(pickerMenu(page)).toBeVisible();

	await imageB.click();

	// The picker menu always drops from — or, when the new image sits low in
	// the viewport, flips just above — its block's live hover bar (see
	// ImagePickerMenu.compute in InlineEditor.jsx). The contract the
	// key-remount fix restores is "the menu re-anchors to the bar of the newly
	// clicked block." Assert that directly: the menu shares the live bar's
	// horizontal center and its near edge sits a small gap from the bar.
	// Pinning the menu's absolute box against image B is brittle — here B's
	// bottom is flush with the viewport, so compute()'s flip-above branch lands
	// the menu ~186px above the bar, clear of B's 160px image (no box overlap)
	// and back up in image A's vertical band. Neither "menu.top ≈ B.top" nor
	// "menu ∩ B" survives this layout; anchoring to the bar does, and still
	// rejects a menu left pinned to A (its near edge lands ~58px off the B bar).
	await expect(pickerMenu(page)).toHaveCount(1);
	await expect
		.poll(async () => {
			const [menu, bar] = await Promise.all([
				pickerMenu(page).boundingBox(),
				hoverBar(page).boundingBox(),
			]);
			if (!menu || !bar) return null;
			const menuCenterX = menu.x + menu.width / 2;
			const barCenterX = bar.x + bar.width / 2;
			// GAP is 6px below the bar; flipped above it the gap also absorbs
			// the menu-height estimate slack (compute clamps with MENU_H=180 vs
			// the ~170px rendered height). 40px clears that, well short of the
			// ~58px a pinned-to-A menu would sit off the relocated bar.
			const nearGap = Math.min(
				Math.abs(menu.y - (bar.y + bar.height)),
				Math.abs(bar.y - (menu.y + menu.height)),
			);
			return Math.abs(menuCenterX - barCenterX) <= 8 && nearGap <= 40;
		})
		.toBe(true);
});
