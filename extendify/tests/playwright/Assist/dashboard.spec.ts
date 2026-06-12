import { expect, test } from '../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Assist dashboard makes a single router-data POST and no data GETs on load', async ({
	admin,
	page,
}) => {
	const requests: { url: string; method: string }[] = [];
	page.on('request', (req) => {
		const url = req.url();
		if (url.includes('/extendify/v1/assist')) {
			requests.push({ url, method: req.method() });
		}
	});

	await admin.visitAdminPage('admin.php', 'page=extendify-assist');
	await expect(page.getByTestId('assist-landing')).toBeVisible({
		timeout: 15_000,
	});
	await page.waitForLoadState('networkidle');

	const matches = (path: string, method: string) =>
		requests.filter((r) => r.url.includes(path) && r.method === method);

	expect(matches('assist/task-data', 'GET')).toHaveLength(0);
	expect(matches('assist/router-data', 'GET')).toHaveLength(0);
	expect(matches('assist/global-data', 'GET')).toHaveLength(0);
	expect(matches('assist/recommendation-data', 'GET')).toHaveLength(0);
	expect(matches('assist/dependency-completed', 'GET')).toHaveLength(0);

	expect(matches('assist/global-data', 'POST')).toHaveLength(0);
	expect(matches('assist/delete-domains-recommendations', 'POST')).toHaveLength(
		0,
	);
	expect(matches('assist/recommendation-data', 'POST')).toHaveLength(0);

	expect(matches('assist/router-data', 'POST')).toHaveLength(1);
});
