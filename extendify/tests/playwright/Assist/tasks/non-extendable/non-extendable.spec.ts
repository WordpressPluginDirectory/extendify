import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-tasks-module')).toBeVisible({
		timeout: 15_000,
	});
});

test('"Explore the Design Library" task is still available on a non-extendable theme with Launch not completed', async ({
	page,
}) => {
	await expect(page.getByTestId('assist-tasks-module')).toContainText(
		'Explore the Design Library',
	);
});

test('Welcome-tour task is not offered on a non-extendable theme with Launch not completed', async ({
	page,
}) => {
	await expect(page.getByTestId('assist-tasks-module')).not.toContainText(
		'Take a welcome tour',
	);
});
