// Picking a text color on a heading whose
// sub-range already carries a `<mark style="background-color:…">` ended
// up changing the heading's background, not just its text color. The
// observable contract: after picking a text color on the full heading,
// no mark inside that heading should carry a `background-color` that
// the user didn't pick. Mirror direction: picking a highlight color on
// a range that already has a text color shouldn't drop the text color.

import { expect, test } from '../../fixtures';

const HEADING_WITH_MARK = 'Custom Made Wood Tables Crafted to Yes!';
const HEADING_PLAIN = 'A plain heading with no pre-existing marks at all.';
const PARAGRAPH_WITH_MARK = 'Here is some sample text';
const PARAGRAPH_SELECT_TEXT = 'is some sample';

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const heading = (page, text: string) =>
	page.locator('h2.wp-block-heading', { hasText: text });

const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();

const floatingBar = (page) =>
	page.locator('[data-test="quick-edit-floating-bar"]');

const textColorButton = (page) =>
	floatingBar(page).getByRole('button', { name: /^Text color$/ });

const highlightButton = (page) =>
	floatingBar(page).getByRole('button', { name: /^Highlight color$/ });

const colorPopover = (page) =>
	page.locator('.extendify-quick-edit-color-popover');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const openInlineEditor = async (page, target) => {
	await target.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(editorRichText(page)).toBeVisible();
};

const selectAllInEditor = async (page) => {
	const editable = editorRichText(page);
	await editable.evaluate((el: HTMLElement) => el.focus());
	const platform = await page.evaluate(() => navigator.platform);
	const modifier = /Mac/.test(platform) ? 'Meta' : 'Control';
	await page.keyboard.press(`${modifier}+a`);
};

const pickPaletteColor = async (page, name: string) => {
	const popover = colorPopover(page);
	const swatch = popover.getByRole('option', { name });
	await swatch.click();
	await expect(popover).toBeHidden();
};

const editableMarksHtml = async (page) =>
	editorRichText(page).evaluate((el) =>
		Array.from(el.querySelectorAll('mark')).map((m) => ({
			style: m.getAttribute('style') || '',
			text: m.textContent,
		})),
	);

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('picking a text color on a heading with a sub-range bg preserves the bg only on its sub-range', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, heading(page, HEADING_WITH_MARK));
	await selectAllInEditor(page);

	await textColorButton(page).click();
	await expect(colorPopover(page)).toBeVisible();
	await pickPaletteColor(page, 'Vivid red');

	const editorMarks = await editableMarksHtml(page);
	for (const m of editorMarks) {
		expect(m.style).toMatch(/color:\s*#cf2e2e/i);
	}
	const middle = editorMarks.find((m) => m.text === 'Made');
	expect(
		middle,
		'a mark covering exactly "Made" should remain after the text-color pick',
	).toBeTruthy();
	expect(middle?.style).toMatch(/background-color:\s*#ff66aa/i);
	for (const m of editorMarks) {
		if (m.text === 'Made') continue;
		expect(
			m.style,
			`non-"Made" marks should have transparent bg; got: ${m.style} (text=${m.text})`,
		).toMatch(/background-color:\s*transparent/i);
	}
});

test("Chris's repro: paragraph bg=red on 'some', pick text gray on 'is some sample' — red preserved", async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	const para = page.locator('p.wp-block-paragraph', {
		hasText: PARAGRAPH_WITH_MARK,
	});
	await openInlineEditor(page, para);

	const editable = editorRichText(page);
	await editable.evaluate((el: HTMLElement, sel) => {
		const text = el.textContent || '';
		const i = text.indexOf(sel);
		if (i < 0) throw new Error(`'${sel}' not found in '${text}'`);
		const range = document.createRange();
		let pos = 0;
		let startNode: Node | null = null;
		let startOffset = 0;
		let endNode: Node | null = null;
		let endOffset = 0;
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		let n = walker.nextNode();
		while (n) {
			const len = (n.textContent || '').length;
			if (!startNode && pos + len > i) {
				startNode = n;
				startOffset = i - pos;
			}
			if (!endNode && pos + len >= i + sel.length) {
				endNode = n;
				endOffset = i + sel.length - pos;
				break;
			}
			pos += len;
			n = walker.nextNode();
		}
		if (!startNode || !endNode) throw new Error('range not built');
		range.setStart(startNode, startOffset);
		range.setEnd(endNode, endOffset);
		const dsel = window.getSelection();
		dsel?.removeAllRanges();
		dsel?.addRange(range);
	}, PARAGRAPH_SELECT_TEXT);

	await textColorButton(page).click();
	await expect(colorPopover(page)).toBeVisible();
	await pickPaletteColor(page, 'Cyan bluish gray');

	const marks = await editableMarksHtml(page);
	const map = Object.fromEntries(marks.map((m) => [m.text, m.style]));
	expect(map['is ']).toMatch(/color:\s*#abb8c3/i);
	expect(map['is ']).toMatch(/background-color:\s*transparent/i);
	expect(map.some).toMatch(/color:\s*#abb8c3/i);
	expect(map.some).toMatch(/background-color:\s*#cf2e2e/i);
	expect(map[' sample']).toMatch(/color:\s*#abb8c3/i);
	expect(map[' sample']).toMatch(/background-color:\s*transparent/i);
});

test('picking a text color on a plain heading writes ONE segment with color + transparent bg', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, heading(page, HEADING_PLAIN));
	await selectAllInEditor(page);

	await textColorButton(page).click();
	await expect(colorPopover(page)).toBeVisible();
	await pickPaletteColor(page, 'Vivid red');

	const editorMarks = await editableMarksHtml(page);
	expect(editorMarks.length).toBe(1);
	expect(editorMarks[0].style).toMatch(/color:\s*#cf2e2e/i);
	expect(editorMarks[0].style).toMatch(/background-color:\s*transparent/i);
});

test('picking a highlight on a range that already has text color preserves the text color', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, heading(page, HEADING_PLAIN));
	await selectAllInEditor(page);

	await textColorButton(page).click();
	await pickPaletteColor(page, 'Vivid red');

	await selectAllInEditor(page);
	await highlightButton(page).click();
	await expect(colorPopover(page)).toBeVisible();
	await pickPaletteColor(page, 'Luminous vivid amber');

	const marks = await editableMarksHtml(page);
	expect(marks.length).toBeGreaterThan(0);
	const merged = marks[0];
	expect(merged.style).toMatch(/color:\s*#cf2e2e/i);
	expect(merged.style).toMatch(/background-color:\s*#fcb900/i);
});
