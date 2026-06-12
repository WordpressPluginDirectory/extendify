import { expect, test } from '../../fixtures';

// Regression guard for the Esc re-engage fix. After
// pressing Esc on the QE canvas the bar should re-engage on the previously
// edited block. The existing `click-rule.spec.ts` Esc test moves the
// mouse to (5, 5) before pressing Esc and the assertion catches the brief
// window when the bar IS visible. The user's actual gesture leaves the
// cursor over the QE area, focus on the contenteditable, and the
// keyboard-entry's onFocusOut → hideBar setTimeout(0) fires after the
// React unmount removes the floating-bar — clearing the just-rendered
// bar. The 300ms hold below outlasts that timer.

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

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

test('pressing Esc on the QE canvas re-engages the bar and the bar stays visible', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const heading = page.locator('h2.wp-block-heading', {
		hasText: 'Sticky selection heading',
	});
	await expect(heading).toBeVisible();

	await heading.hover();
	await expect(hoverBar(page)).toBeVisible();

	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	const canvas = page.locator('.extendify-quick-edit-canvas');
	await expect(canvas).toBeVisible();
	await expect(hoverBar(page)).toHaveCount(0);

	await page.keyboard.press('Escape');

	await expect(canvas).toHaveCount(0);
	await expect(hoverBar(page)).toBeVisible();
	// Outlast the focusout → hideBar setTimeout race that originally
	// killed the freshly-rendered bar.
	await page.waitForTimeout(300);
	await expect(hoverBar(page)).toBeVisible();
});
