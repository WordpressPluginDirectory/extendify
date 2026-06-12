import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Tours section lists available tours', async ({ admin, page }) => {
	await admin.visitAdminPage('index.php');

	await page.getByTestId('help-center-adminbar-button').click();

	const toursSection = page.getByTestId('help-center-tours-section');
	await expect(toursSection).toBeAttached();
	await expect(toursSection).toContainText(
		'Learn more about your WordPress admin',
	);

	await page.getByTestId('help-center-tours-open-button').click();

	const items = page.getByTestId('help-center-tours-items-list').locator('li');
	expect(await items.count()).toBeGreaterThan(1);
});

test('Completing a tour shows the restart icon', async ({ admin, page }) => {
	await admin.visitAdminPage('index.php');

	await page.getByTestId('help-center-adminbar-button').click();
	await page.getByTestId('help-center-tours-open-button').click();

	await page
		.getByTestId('help-center-tours-items-list')
		.locator('li')
		.first()
		.locator('button')
		.click();

	await page
		.locator('#extendify-tour-navigation nav[aria-label="Tour Steps"] button')
		.last()
		.click();

	await page.locator('#help-center-tour-next-button').click();

	await page.getByTestId('help-center-toggle-minimize-button').click();

	await expect(page.getByTestId('restart-tour-icon')).toHaveCount(1);
});
