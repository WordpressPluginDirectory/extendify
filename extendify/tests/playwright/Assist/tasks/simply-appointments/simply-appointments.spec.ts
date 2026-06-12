import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(
		page.getByTestId('assist-task-setup-simply-appointments'),
	).toBeVisible({ timeout: 15_000 });
});

test('Simply Schedule Appointments setup task surfaces when the plugin is active and can be dismissed to a completed state', async ({
	page,
}) => {
	await page.getByTestId('assist-task-setup-simply-appointments').click();

	const tasksModule = page.getByTestId('assist-tasks-module');
	await expect(tasksModule).toContainText('Set up appointments');
	await expect(tasksModule).toContainText(
		'Start accepting appointments on your website by configuring the Simply Scheduled Appointments plugin.',
	);

	const card = page.getByTestId('assist-task-card-wrapper').filter({
		has: page.getByText('Set up appointments'),
	});
	await card.getByRole('button', { name: 'Dismiss' }).click();

	await expect(card.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
	expect(
		await page.getByTestId('completed-task-icon').count(),
	).toBeGreaterThanOrEqual(1);
});
