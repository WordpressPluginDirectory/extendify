import { expect, test } from '../../fixtures';

// Contract: cursor differentiates the click rule before the
// click. Inside edit mode, tagged blocks read as selectable (crosshair),
// anchors read as navigation (pointer), form controls read as form
// controls (UA-default, e.g. `text` for an input). Outside edit mode,
// no crosshair bleeds through.

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

// This blueprint marks Launch completed, and edit mode now seeds its default
// from launch-completed — so the "off" state has to be set explicitly rather
// than relying on the absence of persisted state.
const disableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: false }, version: 0 }),
		);
	});
};

const cursorOn = (locator) =>
	locator.evaluate((el) => window.getComputedStyle(el).cursor);

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('a tagged paragraph in edit mode shows the crosshair cursor', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'Cursor rule paragraph',
	});
	await expect(paragraph).toBeVisible();
	expect(await cursorOn(paragraph)).toBe('crosshair');
});

test('an inline anchor inside a tagged paragraph shows pointer, not crosshair', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const link = page.getByRole('link', { name: 'inline link' });
	await expect(link).toBeVisible();
	expect(await cursorOn(link)).toBe('pointer');
});

test('a search input inside its tagged form shows the native text cursor', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const search = page.getByRole('searchbox');
	await expect(search).toBeVisible();
	expect(await cursorOn(search)).toBe('text');
});

test('with edit mode off, the same tagged paragraph does not show crosshair', async ({
	page,
}) => {
	await disableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'Cursor rule paragraph',
	});
	await expect(paragraph).toBeVisible();
	const cursor = await cursorOn(paragraph);
	expect(cursor).not.toBe('crosshair');
});
