import { expect, test } from '../../fixtures';

// Both the Quick Edit and Toolbar
// stylesheets gained a `@media (prefers-reduced-motion: reduce)` block. These
// specs pin the motions flagged as the most important to suppress
// for vestibular-sensitive users — the infinite upload spinner, the
// spring-tracked hover outline, and the toolbar reframe slide — against a
// default-motion control. The reduced-vs-control contrast is the guard: if the
// media query were missing (or the emulation a no-op) the reduced cases would
// read the same animated values as the control.
//
// Reduced motion is driven via page.emulateMedia, NOT test.use({ reducedMotion }):
// @wordpress/e2e-test-utils-playwright's page fixture builds its own context and
// drops the reducedMotion use-option, so the use() form silently no-ops.

const SPINNER_KEYFRAME = 'extendify-quick-edit-media-uploading-spin';
const HEADING = 'First heading for inline-text testing.';

// The spinner is a `::before` on a wp.media frame that only exists mid-upload.
// Driving a real upload is slow + flaky, so build the exact ancestor chain the
// rule targets and read the pseudo-element's computed animation. The rule is
// page-level (`no-prefix`), so a body-appended host matches it.
const spinnerAnimationName = (page) =>
	page.evaluate(() => {
		const modal = document.createElement('div');
		modal.className = 'media-modal extendify-quick-edit-media-uploading';
		const content = document.createElement('div');
		content.className = 'media-frame-content';
		modal.appendChild(content);
		document.body.appendChild(modal);
		return getComputedStyle(content, '::before').animationName;
	});

const transitionDuration = (locator) =>
	locator.evaluate((el) => getComputedStyle(el).transitionDuration);

// Edit-mode-on so the hover-bar JS builds the body-level outline on hover.
const enableEditMode = (page) =>
	page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});

const showHoverOutline = async (page) => {
	await page.locator('h2.wp-block-heading', { hasText: HEADING }).hover();
	const outline = page.locator(
		'.extendify-quick-edit-hover-outline.is-visible',
	);
	await expect(outline).toBeVisible();
	return outline;
};

const toolbar = (page) => page.locator('#extendify-toolbar');

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test.describe('prefers-reduced-motion: reduce', () => {
	test('the infinite upload spinner animation is suppressed', async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		expect(await spinnerAnimationName(page)).toBe('none');
	});

	test('the hover outline tracks instantly (transition collapsed)', async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await enableEditMode(page);
		await page.goto('/');

		const outline = await showHoverOutline(page);
		expect(await transitionDuration(outline)).toBe('0s');
	});

	test('the toolbar reframe slide is disabled', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await expect(toolbar(page)).toBeVisible();
		expect(await transitionDuration(toolbar(page))).toBe('0s');
	});
});

test.describe('default motion (control)', () => {
	test('the upload spinner animates', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/');
		expect(await spinnerAnimationName(page)).toBe(SPINNER_KEYFRAME);
	});

	test('the hover outline keeps its spring transition', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await enableEditMode(page);
		await page.goto('/');

		const outline = await showHoverOutline(page);
		expect(await transitionDuration(outline)).not.toBe('0s');
	});

	test('the toolbar keeps its reframe slide', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/');
		await expect(toolbar(page)).toBeVisible();
		expect(await transitionDuration(toolbar(page))).not.toBe('0s');
	});
});
