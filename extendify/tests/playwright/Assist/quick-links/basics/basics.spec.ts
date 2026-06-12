import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
});

test('Quick Links module renders multiple links', async ({ page }) => {
	const links = page.getByTestId('assist-quick-links-module').locator('a');
	await expect(links.first()).toBeVisible({ timeout: 15_000 });
	expect(await links.count()).toBeGreaterThan(0);
});

test('Add new page quick link routes to post-new.php?post_type=page', async ({
	page,
}) => {
	await page.getByTestId('assist-quick-links-module-add-new-page').click();
	await expect(page).toHaveURL(/post-new\.php\?post_type=page/);
});

test('Reset site quick link is visible when Launch is completed on the Extendable theme', async ({
	page,
}) => {
	await expect(
		page.getByTestId('assist-quick-links-module-reset-site'),
	).toBeVisible();
});
