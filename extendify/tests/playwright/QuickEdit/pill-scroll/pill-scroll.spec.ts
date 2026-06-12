import { expect, test } from '../../fixtures';

// Mouse-wheel events over the Ask AI / Quick Edit pill must
// scroll the page underneath. The bar is position:fixed; wheel default
// should bubble to the viewport scroller, but in production it wasn't.
// Regression-pinning: hover a tagged block to surface the bar, dispatch
// a wheel event over a pill, assert window.scrollY moved.

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

test('mouse-wheel over the Quick Edit pill scrolls the page', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'Tagged paragraph the pill bar attaches to',
	});
	await expect(paragraph).toBeVisible();
	await paragraph.hover();

	const pill = page.locator('.extendify-quick-edit-pill').first();
	await expect(pill).toBeVisible();

	const startY = await page.evaluate(() => window.scrollY);
	const box = await pill.boundingBox();
	if (!box) throw new Error('pill has no bounding box');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, 400);

	await expect
		.poll(() => page.evaluate(() => window.scrollY))
		.toBeGreaterThan(startY);
});

test('mouse-wheel over the Ask AI pill scrolls the page', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'Tagged paragraph the pill bar attaches to',
	});
	await expect(paragraph).toBeVisible();
	await paragraph.hover();

	const aiPill = page.locator('.extendify-quick-edit-pill-ai').first();
	await expect(aiPill).toBeVisible();

	const startY = await page.evaluate(() => window.scrollY);
	const box = await aiPill.boundingBox();
	if (!box) throw new Error('AI pill has no bounding box');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, 400);

	await expect
		.poll(() => page.evaluate(() => window.scrollY))
		.toBeGreaterThan(startY);
});
