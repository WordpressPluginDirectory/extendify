// e2e:disabled — port of the Cypress spec that's commented out in
// cypress-push.yml's matrix. Mirrors Cypress's "ported but flaky / not run in
// CI" state. Remove this marker to enable.
import { expect, test } from '../../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Draft consent prompt can be dismissed', async ({ admin, page }) => {
	await admin.visitAdminPage('post-new.php', 'post_type=page');

	const toggle = page
		.locator('button[aria-controls="extendify-draft:draft"]')
		.first();
	await expect(toggle).toBeVisible({ timeout: 15_000 });
	await toggle.click();

	const consentButton = page.getByTestId('draft-terms-button');
	await expect(consentButton).toBeVisible();
	await expect(consentButton).toBeEnabled();
	await consentButton.click();

	await expect(consentButton).toHaveCount(0);

	const textarea = page.locator('#draft-ai-textarea');
	await expect(textarea).toBeVisible();
	await expect(textarea).toBeEnabled();
	await expect(textarea).toHaveAttribute('placeholder', /.+/);
});
