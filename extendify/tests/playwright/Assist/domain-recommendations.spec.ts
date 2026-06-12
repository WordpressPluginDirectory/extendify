import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils, admin }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
});

test('Domain recommendation banners are not visible without partner flags', async ({
	page,
}) => {
	const settings = await page.evaluate(
		() =>
			(
				window as unknown as {
					extAssistData: { domainsSuggestionSettings: Record<string, unknown> };
				}
			).extAssistData.domainsSuggestionSettings,
	);
	expect(settings.showBanner).toBe(false);
	expect(settings.showSecondaryBanner).toBe(false);

	await expect(
		page.getByTestId('assist-domain-banner-main-domain-module'),
	).toHaveCount(0);
	await expect(
		page.getByTestId('assist-domain-banner-secondary-domain-module'),
	).toHaveCount(0);
});

test('Domain recommendation tasks are not visible without partner flags', async ({
	page,
}) => {
	const settings = await page.evaluate(
		() =>
			(
				window as unknown as {
					extAssistData: { domainsSuggestionSettings: Record<string, unknown> };
				}
			).extAssistData.domainsSuggestionSettings,
	);
	expect(settings.showTask).toBe(false);
	expect(settings.showSecondaryTask).toBe(false);

	await expect(
		page.getByTestId('assist-domain-card-main-domain-module'),
	).toHaveCount(0);
	await expect(
		page.getByTestId('assist-domain-card-secondary-domain-module'),
	).toHaveCount(0);
});
