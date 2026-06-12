import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
});

test('Reset site link routes to ?page=extendify-launch', async ({ page }) => {
	const resetLink = page.getByTestId('assist-quick-links-module-reset-site');
	await expect(resetLink).toBeVisible({ timeout: 15_000 });
	await resetLink.click();
	await expect(page).toHaveURL(/admin\.php\?page=extendify-launch/);
});
