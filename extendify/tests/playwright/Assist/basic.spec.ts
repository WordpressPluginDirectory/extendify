import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Assist dashboard is reachable when Launch is disabled', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-landing')).toBeVisible({
		timeout: 15_000,
	});
});
