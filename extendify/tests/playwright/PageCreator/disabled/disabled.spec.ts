import { expect, test } from '../../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Page Creator button is absent when showAIPageCreation is disabled', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('post-new.php', 'post_type=page');

	// Library auto-opens on the page editor when no wp_extendify_library_user
	// meta is seeded — used here as a positive signal that the Extendify
	// bundles have actually loaded, so a count=0 assertion on the page-creator
	// button is meaningful (not just "JS hasn't run yet").
	await expect(page.locator('.extendify-library-modal')).toBeVisible({
		timeout: 15_000,
	});

	await expect(
		page.locator('#extendify-page-creator-btn > div[role="button"]'),
	).toHaveCount(0);
});
