import { expect, test } from './fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('admin can reach the WP dashboard', async ({ admin, page }) => {
	await admin.visitAdminPage('index.php');
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
