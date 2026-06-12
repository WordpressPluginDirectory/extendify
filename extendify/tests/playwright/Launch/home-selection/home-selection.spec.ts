// e2e:disabled
import { expect, test } from '../../fixtures';
import {
	homeTemplatesStub,
	imagesStub,
	siteProfileStub,
	siteStringsStub,
	stylesStub,
} from '../_mocks';

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();

	// usePagesStore persists currentPageIndex to localStorage keyed by siteId
	// (`extendify-pages-${siteId}`). Layout is page 5 with showLaunchQuestions
	// off. Blueprints can't touch localStorage; addInitScript runs before any
	// page script — no runtime mutation.
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-pages-12345',
			JSON.stringify({
				state: { currentPageIndex: 5, currentPageSlug: 'layout' },
				version: 0,
			}),
		);
	});

	// Per-spec page.route convention. Five external endpoints feed
	// the Layout screen (site-profile → site-strings + site-images + styles;
	// home-templates consumes all of them). Hand-crafted minimal payloads from
	// _mocks.ts so later Launch specs can reuse the shapes.
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
	await page.route('**/api/search*', (route) =>
		route.fulfill({ status: 200, json: imagesStub }),
	);

	await admin.visitAdminPage('admin.php', 'page=extendify-launch');
});

test('renders home layouts, gates next on selection, and resets on reload', async ({
	page,
}) => {
	await expect(
		page.getByRole('heading', { name: /Pick a design for your website/i }),
	).toBeVisible();

	const previews = page.getByTestId('layout-preview');
	await expect(previews).toHaveCount(homeTemplatesStub.length);

	// Nothing is selected on mount — DesignSelector resets style + variation
	// before iterating homeLayouts, so aria-selected is "false" across the row.
	await expect(previews.first()).toHaveAttribute('aria-selected', 'false');
	await expect(page.getByTestId('next-button')).toBeDisabled();

	// Click any preview → that one becomes selected, next button enables.
	await previews.last().click();
	await expect(previews.last()).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('next-button')).toBeEnabled();

	// Selection lives in usePagesSelectionStore (localStorage), but the screen
	// re-runs setStyle(null) on every mount. Reload → unselected, next gated.
	await page.reload();
	const reloadedPreviews = page.getByTestId('layout-preview');
	await expect(reloadedPreviews.first()).toHaveAttribute(
		'aria-selected',
		'false',
	);
	await expect(page.getByTestId('next-button')).toBeDisabled();
});
