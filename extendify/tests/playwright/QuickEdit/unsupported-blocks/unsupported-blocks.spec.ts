import { expect, test } from '../../fixtures';

// Pins the selector-unification contract: blocks that have no
// Quick Edit modal (group, media+text, …) are still selectable — the
// hover outline + Ask AI pill render — but the Quick Edit pill stays
// hidden because hasQuickEditModalFor() returns false.

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');
const hoverOutline = (page) =>
	page.locator('.extendify-quick-edit-hover-outline.is-visible');

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

test('hovering a group block surfaces outline + Ask AI pill, no Quick Edit pill', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const group = page.locator('#group-target');
	await expect(group).toBeVisible();
	// Hover inside the group's padding region, not the centered child
	// heading. Innermost-tagged wins, so a center hover
	// would land on the heading and surface the Quick Edit pill.
	const box = await group.boundingBox();
	if (!box) throw new Error('group bounding box missing');
	await page.mouse.move(box.x + 20, box.y + 20);

	await expect(hoverOutline(page)).toBeVisible();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toHaveCount(0);
});

test('hovering a media+text block surfaces outline + Ask AI pill, no Quick Edit pill', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const mediaText = page.locator('#media-text-target');
	await expect(mediaText).toBeVisible();
	await mediaText.hover();

	await expect(hoverOutline(page)).toBeVisible();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toHaveCount(0);
});
