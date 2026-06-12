import { expect, test } from '../../fixtures';

// A paragraph that sits directly below
// a heading is selectable as the paragraph, not bumped to the heading.
// `findTagged` used to prefer `isRecognizedBlockEl` ancestors,
// so a paragraph hover walked up past the paragraph and resolved to
// the heading. With the type-gate dropped and the capture-phase click in
// place, the walk lands on the innermost tagged ancestor and
// the heading is no longer pulled in.

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

const rectOf = async (locator) =>
	locator.evaluate((el) => {
		const r = el.getBoundingClientRect();
		return { top: r.top, left: r.left, width: r.width, height: r.height };
	});

const outlineRect = async (page) =>
	page.locator('.extendify-quick-edit-hover-outline').evaluate((el) => ({
		top: parseFloat(el.style.top),
		left: parseFloat(el.style.left),
		width: parseFloat(el.style.width),
		height: parseFloat(el.style.height),
	}));

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('top-level paragraph directly below a heading resolves to the paragraph', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('#top-paragraph');
	await expect(paragraph).toBeVisible();
	await paragraph.hover();

	await expect(hoverOutline(page)).toBeVisible();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();

	const expected = await rectOf(paragraph);
	const actual = await outlineRect(page);
	// Outline tracks the paragraph, not the heading sitting above it.
	expect(Math.abs(actual.top - expected.top)).toBeLessThan(2);
	expect(Math.abs(actual.height - expected.height)).toBeLessThan(2);
});

test('paragraph nested inside a group resolves to the paragraph, not the heading sibling', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const groupParagraph = page.locator('#group-paragraph');
	const groupHeading = page.locator('#group-heading');
	await expect(groupParagraph).toBeVisible();
	await groupParagraph.hover();

	await expect(hoverOutline(page)).toBeVisible();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();

	const expected = await rectOf(groupParagraph);
	const headingRect = await rectOf(groupHeading);
	const actual = await outlineRect(page);
	// Outline lands on the paragraph — TagBlocks tags inner blocks too, so
	// the innermost tagged ancestor is the paragraph itself.
	expect(Math.abs(actual.top - expected.top)).toBeLessThan(2);
	expect(Math.abs(actual.height - expected.height)).toBeLessThan(2);
	// The old behavior walked up to the recognized heading sibling; the
	// outline would have matched the heading's rect instead.
	expect(Math.abs(actual.top - headingRect.top)).toBeGreaterThan(2);
});

test('clicking the top-level paragraph commits selection on the paragraph', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('#top-paragraph');
	await expect(paragraph).toBeVisible();
	await paragraph.click();

	// The paragraph is quick-editable, so a two-pill click opens QE directly
	// (Option 7) rather than committing a sticky hover bar. The canvas
	// mounting on the paragraph — not the heading above it — is the commit.
	const canvas = page.locator('.extendify-quick-edit-canvas');
	await expect(canvas).toBeVisible();
	await expect(
		canvas.locator('.block-editor-rich-text__editable'),
	).toContainText('Top-level paragraph sitting directly below the heading');
});
