// e2e:disabled
import { expect, test } from '../fixtures';

type OptionResponse = { success: boolean; data: string | null };

test.beforeEach(async ({ requestUtils, admin }) => {
	await requestUtils.login();
	// wp-playground's default admin user matches `admin_email`, so the first
	// /wp-admin/ visit with no `extendify_launch_loaded` option seeded fires
	// AdminPageRouter::redirectOnce — it writes `extendify_attempted_redirect`
	// synchronously in PHP and redirects to ?page=extendify-launch, where the
	// React mount writes `extendify_launch_loaded` via POST /launch/options.
	await admin.visitAdminPage('index.php', '');
});

test('Tests the Launch redirect and db value', async ({
	page,
	requestUtils,
}) => {
	await expect(page).toHaveURL(/admin\.php\?page=extendify-launch/);

	await expect
		.poll(async () => {
			const res = await requestUtils.rest<OptionResponse>({
				path: '/extendify/v1/launch/options?option=extendify_attempted_redirect',
			});
			return res.data ?? '';
		})
		.toMatch(/\d{4}-\d{2}-\d{2}/);

	await expect
		.poll(async () => {
			const res = await requestUtils.rest<OptionResponse>({
				path: '/extendify/v1/launch/options?option=extendify_launch_loaded',
			});
			return res.data ?? '';
		})
		.toMatch(/\d{4}-\d{2}-\d{2}/);
});
