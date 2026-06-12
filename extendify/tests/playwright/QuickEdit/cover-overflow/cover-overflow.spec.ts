// Pins the QE canvas's `findOpaqueBackground`
// cover handling end to end:
//
// - Image-only covers (dim-0, no overlay color) → the host's background-color
//   falls back to `rgba(0, 0, 0, 0.5)` so overflow text typed past the cover's
//   height has a legible backdrop instead of the bare page background.
//
// - Covers with an opaque overlay span (dim-N, overlayColor set) → the host
//   echoes the overlay tint by reading the `.wp-block-cover__background`
//   direct-child span's computed bg-color × CSS opacity. An earlier version
//   read the cover div (always transparent) instead and regressed this
//   case to the floor; moving to the span fixed it. Both branches need a guard.

import { expect, test } from '../../fixtures';

const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const imageOnlyHeading = (page) => page.locator('h2.image-only-heading');

const overlayHeading = (page) => page.locator('h2.overlay-heading');

const canvasHost = (page) => page.locator('[data-test="quick-edit-host"]');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const openInlineEditor = async (page, headingLocator) => {
	await headingLocator.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(canvasHost(page)).toBeAttached();
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('image-only cover host gets the semi-transparent black floor', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, imageOnlyHeading(page));

	// dim-0 makes the `__background` span effectively transparent (opacity 0).
	// findOpaqueBackground's overlay-read path bails and the fallback emits
	// `rgba(0, 0, 0, 0.5)`. Browser normalizes the inline `rgba(0, 0, 0, 0.500)`
	// emit shape to the canonical form.
	await expect(canvasHost(page)).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0.5)',
	);
});

test('cover with overlay span has host echo the overlay color', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	await openInlineEditor(page, overlayHeading(page));

	// dim-90 + overlayColor: background → the span resolves to
	// rgb(255, 255, 255) at CSS opacity 0.9 in Extendable's default palette.
	// findOpaqueBackground multiplies alpha by opacity and emits
	// `rgba(255, 255, 255, 0.900)` which Chrome normalizes to drop trailing
	// zeros. This is also a regression guard — an earlier commit returned
	// the floor here, dimming an area that visually was a frosted-white box.
	await expect(canvasHost(page)).toHaveCSS(
		'background-color',
		'rgba(255, 255, 255, 0.9)',
	);
});
