import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Page Creator modal auto-opens when showAIPageCreation is enabled', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('post-new.php', 'post_type=page');

	const button = page.locator(
		'#extendify-page-creator-btn > div[role="button"]',
	);
	await expect(button).toBeVisible({ timeout: 15_000 });

	const modal = page.locator('.extendify-page-creator-modal');
	await expect(modal).toBeVisible();

	await page.getByTestId('modal-close-button').click();
	await expect(modal).toBeHidden();
});
