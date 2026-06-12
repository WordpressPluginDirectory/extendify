import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-landing')).toBeVisible({
		timeout: 15_000,
	});
});

test('Recommendations module does not render when the recommendations cache is empty', async ({
	page,
}) => {
	await expect(page.getByTestId('assist-recommendations-module')).toHaveCount(
		0,
	);
});
