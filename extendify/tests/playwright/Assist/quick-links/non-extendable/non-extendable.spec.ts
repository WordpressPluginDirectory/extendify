import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-quick-links-module')).toBeVisible({
		timeout: 15_000,
	});
});

test('Edit header quick link is hidden on a non-extendable theme', async ({
	page,
}) => {
	await expect(
		page.getByTestId('assist-quick-links-module-edit-header'),
	).toHaveCount(0);
});

test('Edit footer quick link is hidden on a non-extendable theme', async ({
	page,
}) => {
	await expect(
		page.getByTestId('assist-quick-links-module-edit-footer'),
	).toHaveCount(0);
});

test('Reset site quick link is hidden on a non-extendable theme', async ({
	page,
}) => {
	await expect(
		page.getByTestId('assist-quick-links-module-reset-site'),
	).toHaveCount(0);
});
