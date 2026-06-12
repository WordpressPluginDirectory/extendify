import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Help Center modal opens, minimizes, restores, and closes', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('index.php');

	const modal = page.getByTestId('help-center-modal');
	const minimizeState = page.getByTestId('help-center-minimize-state');

	await page.getByTestId('help-center-adminbar-button').click();
	await expect(modal).toBeAttached();

	await page.getByTestId('help-center-toggle-minimize-button').click();
	await expect(modal).toHaveCount(0);
	await expect(minimizeState).toBeVisible();

	await page.getByTestId('help-center-toggle-minimize-button').click();
	await expect(modal).toBeAttached();
	await expect(minimizeState).toHaveCount(0);

	await page.getByTestId('help-center-close-button').click();
	await expect(modal).toHaveCount(0);
});
