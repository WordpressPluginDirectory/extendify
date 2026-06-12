import { expect, test } from '../../fixtures';

// BlockEditorProvider creates a sub-registry for its
// `core/block-editor` store, and use-block-sync dispatches `resetBlocks(value)`
// as a post-commit effect. Until that effect runs, BlockList children paint
// against whatever the sub-registry's initial state is — and across sessions
// (click heading A, click paragraph B), the cross-block transition routes
// through enough internal state that BlockList briefly renders the PRIOR
// session's content (e.g. heading A's text where paragraph B should appear)
// before settling on the right blocks.
//
// The fix defers the host overlay's visibility (and the live-hide swap) until
// the editable's textContent matches the live block's. The host node is
// created `visibility: hidden`; a polling RAF compares the editable's text
// to the live block's text and flips both in one tick when they match.
//
// Playwright can't catch a 1-2 frame intermediate state, but it CAN pin the
// load-bearing contract: the host is `visibility: hidden` *initially* (not
// just CSS-hidden via opacity), and by the time it becomes visible the
// editable already shows the correct content.

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

test('cross-session click (A → cancel → B) mounts canvas with B content only', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const headingA = page.locator('h2.wp-block-heading', {
		hasText: 'Heading aardvark',
	});
	const paragraphB = page.locator('p.wp-block-paragraph', {
		hasText: 'Paragraph beluga',
	});
	await expect(headingA).toBeVisible();
	await expect(paragraphB).toBeVisible();

	await headingA.click();
	const canvas = page.locator('.extendify-quick-edit-canvas');
	await expect(canvas).toBeVisible();
	const editableA = canvas.locator('.block-editor-rich-text__editable');
	await expect(editableA).toContainText('Heading aardvark');

	await page.locator('[data-test="quick-edit-cancel"]').click();
	await expect(canvas).toHaveCount(0);

	await paragraphB.click();
	await expect(canvas).toBeVisible();
	const editableB = canvas.locator('.block-editor-rich-text__editable');
	await expect(editableB).toContainText('Paragraph beluga');
	await expect(editableB).not.toContainText('aardvark');
});

test('host overlay stays hidden until editable text matches live block', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const headingA = page.locator('h2.wp-block-heading', {
		hasText: 'Heading aardvark',
	});
	const paragraphB = page.locator('p.wp-block-paragraph', {
		hasText: 'Paragraph beluga',
	});
	await expect(headingA).toBeVisible();
	await expect(paragraphB).toBeVisible();

	// Prime the editor singleton with A's content so the cross-session
	// flash window (if any) would surface A's text inside B's canvas.
	await headingA.click();
	const host = page.locator('[data-test="quick-edit-host"]');
	await expect(host).toBeVisible();
	await page.locator('[data-test="quick-edit-cancel"]').click();
	await expect(host).toHaveCount(0);

	// Click B. The host node should be created with `visibility: hidden`
	// initially — visible only AFTER the editable text matches the live
	// block. Asserting it via the inline style attribute lets us catch the
	// pre-reveal state even if Playwright's polling moves past the 1-frame
	// flash window.
	await paragraphB.click();
	const hostB = page.locator('[data-test="quick-edit-host"]');
	await expect(hostB).toHaveCount(1);
	// Once visibility flips to '', the host paints. By then the editable
	// must show beluga (B), not aardvark (A).
	await expect(hostB).toBeVisible();
	const editable = hostB.locator('.block-editor-rich-text__editable');
	await expect(editable).toContainText('Paragraph beluga');
	await expect(editable).not.toContainText('aardvark');
});
