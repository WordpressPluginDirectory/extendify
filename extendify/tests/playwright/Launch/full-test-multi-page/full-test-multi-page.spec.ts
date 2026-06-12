// e2e:disabled
import { expect, test } from '../../fixtures';
import {
	goalsStub,
	homeTemplatesStub,
	imagesStub,
	pageTemplatesStub,
	siteProfileStub,
	siteStringsStub,
	stylesStub,
} from '../_mocks';

// Multi-page counterpart to the single-page spec. Same orchestrator
// flow with one extra screen (PagesSelect) and one additional stub
// (pageTemplatesStub for **/api/page-templates*). Memory-ceiling risk: if
// this flakes intermittently, leave it on Cypress.

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();

	await page.route('**/api/site-profile', (route) =>
		route.fulfill({ status: 200, json: siteProfileStub }),
	);
	await page.route('**/api/site-strings', (route) =>
		route.fulfill({ status: 200, json: siteStringsStub }),
	);
	await page.route('**/api/styles', (route) =>
		route.fulfill({ status: 200, json: stylesStub }),
	);
	await page.route('**/api/home-templates*', (route) =>
		route.fulfill({ status: 200, json: homeTemplatesStub }),
	);
	await page.route('**/api/page-templates*', (route) =>
		route.fulfill({ status: 200, json: pageTemplatesStub }),
	);
	await page.route('**/api/search*', (route) =>
		route.fulfill({ status: 200, json: imagesStub }),
	);
	await page.route('**/launch/goals*', (route) =>
		route.fulfill({ status: 200, json: goalsStub }),
	);
	await page.route('**/insights.extendify.com/api/v1/launch*', (route) =>
		route.fulfill({ status: 200, json: [] }),
	);

	await admin.visitAdminPage('admin.php', 'page=extendify-launch');
});

test('builds a multi-page site and lands on Assist with the success marker', async ({
	page,
}) => {
	test.setTimeout(180_000);

	await expect(
		page.getByRole('heading', {
			name: /What type of website are you creating/i,
		}),
	).toBeVisible();
	await expect(page.getByTestId('next-button')).toBeDisabled();
	await page.getByTestId('site-template-type-business').click();

	await expect(
		page.getByRole('heading', { name: /Tell Us About Your Website/i }),
	).toBeVisible();
	await page.getByTestId('site-title-input').fill('My new site');
	await page.getByTestId('site-info-input').fill('My new site description');
	await expect(page.getByTestId('next-button')).toBeEnabled();
	await page.getByTestId('next-button').click();

	await expect(
		page.getByRole('heading', { name: /Customizing Your Experience/i }),
	).toBeVisible();

	await expect(
		page.getByRole('heading', { name: /Pick Your Site Structure/i }),
	).toBeVisible();
	const structureCards = page.getByTestId('site-template-type');
	await expect(structureCards).toHaveCount(2);
	await page.getByText('Multi-Page Website').click();
	await expect(page.getByTestId('next-button')).toBeEnabled();
	await page.getByTestId('next-button').click();

	await expect(
		page.getByRole('heading', { name: /Designing Your Options/i }),
	).toBeVisible();

	await expect(
		page.getByRole('heading', { name: /Pick a design for your website/i }),
	).toBeVisible();
	const previews = page.getByTestId('layout-preview');
	await expect(previews).toHaveCount(homeTemplatesStub.length);
	await previews.first().click();
	await expect(page.getByTestId('next-button')).toBeEnabled();
	await page.getByTestId('next-button').click();

	// PagesSelect — multi-page only. Recommended pages auto-check on mount;
	// that behavior is covered in detail elsewhere. Here we just confirm the
	// screen renders and advances.
	await expect(
		page.getByRole('heading', {
			name: /Pick the pages to add to your website/i,
		}),
	).toBeVisible();
	const recommended = page.getByTestId('recommended-pages');
	await expect(recommended.getByLabel('Home page')).toBeChecked();
	for (const item of pageTemplatesStub.recommended) {
		await expect(recommended.getByLabel(item.name)).toBeChecked();
	}
	await expect(page.getByTestId('next-button')).toBeEnabled();
	await page.getByTestId('next-button').click();

	await page.waitForURL(/page=extendify-assist.*extendify-launch-success/, {
		timeout: 120_000,
	});
	await expect(page.locator('body')).toContainText('Site Guide', {
		timeout: 30_000,
	});
});
