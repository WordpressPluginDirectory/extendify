import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-task-setup-aioses')).toBeVisible({
		timeout: 15_000,
	});
});

test('AIOSEO setup task surfaces when the plugin is active and can be dismissed to a completed state', async ({
	page,
}) => {
	await page.getByTestId('assist-task-setup-aioses').click();

	const tasksModule = page.getByTestId('assist-tasks-module');
	await expect(tasksModule).toContainText('Set up All in One SEO');
	await expect(tasksModule).toContainText(
		'Set up the All in One SEO plugin to enhance your website discoverability.',
	);

	const card = page.getByTestId('assist-task-card-wrapper').filter({
		has: page.getByText('Set up All in One SEO'),
	});
	await card.getByRole('button', { name: 'Dismiss' }).click();

	await expect(card.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
	expect(
		await page.getByTestId('completed-task-icon').count(),
	).toBeGreaterThanOrEqual(1);
});
