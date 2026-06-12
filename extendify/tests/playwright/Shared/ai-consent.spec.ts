import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('AI Chat consent prompt renders when consent has not been given', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('index.php');

	await page.getByTestId('help-center-adminbar-button').click();
	const aiChatButton = page.getByTestId('help-center-dashboard-ai-chat-button');
	await expect(aiChatButton).toBeVisible({ timeout: 15_000 });
	await aiChatButton.click();

	await expect(
		page.getByTestId('help-center-ai-chat-consent-prompt'),
	).toBeVisible();
});
