import { expect, test } from '../fixtures';

// ShowTitle:B adds a site-title field and SubmitOutside:B pushes the submit
// button below the description, together making the page taller than the
// control. Make sure the "WP Admin Dashboard" exit link is reachable.
// Regression for company-product#2257.

const SHORT_MOBILE = { width: 360, height: 640 };

const forceVariantB = (page) =>
	page.addInitScript(() => {
		let ext: unknown;
		Object.defineProperty(window, 'extLaunchData', {
			configurable: true,
			get: () => ext,
			set: (value) => {
				const data = value as {
					activeTests?: Record<string, { variant: string }>;
				} | null;
				if (data && typeof data === 'object') {
					data.activeTests = {
						...data.activeTests,
						'AutoLaunch.ShowTitle': { variant: 'B' },
						'AutoLaunch.SubmitOutside': { variant: 'B' },
					};
				}
				ext = value;
			},
		});
	});

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('B variant scrolls on a short mobile viewport and the exit link is reachable', async ({
	page,
	admin,
}) => {
	await forceVariantB(page);
	await page.setViewportSize(SHORT_MOBILE);
	await admin.visitAdminPage('admin.php', 'page=extendify-auto-launch');

	const exitLink = page.getByRole('link', { name: 'WP Admin Dashboard' });
	await expect(exitLink).toBeAttached();

	const scroller = page.locator('div.overflow-y-auto');
	await expect(scroller).toHaveCSS('overflow-y', 'auto');

	await exitLink.scrollIntoViewIfNeeded();
	await expect(exitLink).toBeVisible();
});
