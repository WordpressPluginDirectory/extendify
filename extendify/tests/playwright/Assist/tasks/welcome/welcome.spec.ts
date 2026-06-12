import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-tasks-module')).toBeVisible({
		timeout: 15_000,
	});
});

test('Tasks module renders at least one task card on a launch-completed extendable site', async ({
	page,
}) => {
	const cards = page
		.getByTestId('assist-tasks-module')
		.getByTestId('assist-task-card-wrapper');
	expect(await cards.count()).toBeGreaterThan(0);
});

test('"Explore the Design Library" appears in the welcome tasks list', async ({
	page,
}) => {
	await expect(page.getByTestId('assist-tasks-module')).toContainText(
		'Explore the Design Library',
	);
});
