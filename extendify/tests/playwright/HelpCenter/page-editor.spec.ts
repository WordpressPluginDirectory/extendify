import { expect, test } from '../fixtures';

const categoriesStub = [
	{ id: 8, slug: 'hero', name: 'Hero' },
	{ id: 6, slug: 'content', name: 'Content' },
];

const patternsStub = [
	{
		id: '1-stub-hero',
		slug: 'stub-hero',
		name: 'Stub Hero',
		code: '<!-- wp:paragraph --><p>Stub pattern</p><!-- /wp:paragraph -->',
		categories: ['hero'],
	},
];

test.beforeEach(async ({ page, requestUtils }) => {
	await requestUtils.login();

	await page.route(/\/api\/categories/, (route) =>
		route.fulfill({ status: 200, json: categoriesStub }),
	);
	await page.route(/\/api\/patterns/, (route) =>
		route.fulfill({ status: 200, json: patternsStub }),
	);
});

test('Help Center editor-page button opens the modal after closing Library', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('post-new.php', 'post_type=page');

	// Library auto-opens on the page editor (default openOnNewPage when a
	// partner-id is set and disableLibraryAutoOpen is not).
	const libraryModal = page.locator('.extendify-library-modal');
	await expect(libraryModal).toBeVisible({ timeout: 15_000 });

	await page.getByTestId('modal-close-button').click();
	await expect(libraryModal).toHaveCount(0);

	const hcButton = page.getByTestId('help-center-editor-page-button');
	await expect(hcButton).toBeVisible();
	await hcButton.click();

	// `toBeAttached()` matches the HC convention — sidesteps the
	// framer-motion initial-opacity issue on the Dialog wrapper.
	await expect(page.getByTestId('help-center-modal')).toBeAttached();
});
