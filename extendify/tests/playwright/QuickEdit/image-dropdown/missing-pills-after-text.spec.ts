import { expect, test } from '../../fixtures';

// The actual reported bug. With a non-picker
// block previously selected (e.g. a paragraph opened in the QE
// canvas), clicking a picker block (image / cover) used to mount the
// hover bar via renderBar and then immediately tear it down because
// `unsubSelected` subscribes to the whole store and fires once for
// `setCommittedSelection(null)` in `onEditClick` before `setSelected`
// has updated `state.selected`. At that moment the subscriber sees
// the prior non-picker `selected` and calls `clearBar()`. The picker
// menu mounts via React but the hover-bar with QE / Ask AI pills is
// gone — visible as a floating dropdown on the image with no pills,
// no dashed outline.

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const hoverOutline = (page) =>
	page.locator('.extendify-quick-edit-hover-outline.is-visible');

const paragraphBlock = (page) =>
	page.locator('p[data-extendify-agent-block-id]').first();

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

test('click text block then image: hover bar with pills survives', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentSidebar(page);

	const paragraph = paragraphBlock(page);
	const image = imageBlock(page, 0);
	await expect(paragraph).toBeVisible();
	await expect(image).toBeVisible();

	// Step 1 — open QE on the paragraph via its hover-bar QE pill.
	// `selected` is now a text-block descriptor (non-picker), the QE
	// canvas is mounted, and the hover bar is intentionally torn down
	// (text blocks don't keep the bar around — that's BlockTextEditor's
	// own floating bar's job).
	await paragraph.hover();
	await expect(hoverBar(page)).toBeVisible();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(
		page.locator('[data-test="quick-edit-floating-bar"]'),
	).toBeVisible();

	// Step 2 — click the image. onDocClickCapture must `renderBar(image)`
	// AND keep that bar alive across `onEditClick`'s
	// `setCommittedSelection(null)` + `setSelected({...image})` sequence.
	await image.click();

	// User-visible contract: picker menu, hover bar with both pills, AND
	// the dashed outline overlay all visible at once.
	await expect(pickerMenu(page)).toBeVisible();
	await expect(hoverBar(page)).toBeVisible();
	await expect(
		hoverBar(page).getByRole('button', { name: /Quick Edit/ }),
	).toBeVisible();
	await expect(
		hoverBar(page).getByRole('button', { name: /Ask AI/ }),
	).toBeVisible();
	await expect(hoverOutline(page)).toBeVisible();
});
