import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-tasks-module')).toBeVisible({
		timeout: 15_000,
	});
});

test('"Continue with site builder" task is offered when Launch is in-progress', async ({
	page,
}) => {
	const tasksModule = page.getByTestId('assist-tasks-module');
	await expect(tasksModule).toContainText('Continue with site builder');
	await expect(tasksModule).toContainText(
		'Create a super-fast, beautiful, and fully customized site',
	);
});
