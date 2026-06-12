import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Draft sidebar opens with no consent button when consent is disabled', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('post-new.php', 'post_type=page');

	const toggle = page
		.locator('button[aria-controls="extendify-draft:draft"]')
		.first();
	await expect(toggle).toBeVisible({ timeout: 15_000 });
	await toggle.click();

	await expect(page.getByTestId('draft-terms-button')).toHaveCount(0);

	const textarea = page.locator('#draft-ai-textarea');
	await expect(textarea).toBeVisible();
	await expect(textarea).toBeEnabled();
	await expect(textarea).toHaveAttribute('placeholder', /.+/);
});
