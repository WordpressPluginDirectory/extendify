import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
});

test('Secondary domain recommendation banner and task are visible on live hostname', async ({
	page,
}) => {
	await expect(
		page.getByTestId('assist-domain-banner-secondary-domain-module'),
	).toBeVisible({ timeout: 15_000 });

	await expect(
		page
			.getByTestId('assist-tasks-module')
			.getByText('Add an additional domain'),
	).toBeVisible();
});
