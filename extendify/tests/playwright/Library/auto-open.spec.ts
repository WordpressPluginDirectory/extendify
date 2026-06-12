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

test('Library modal auto-loads when a partner id is set', async ({
	admin,
	page,
}) => {
	await admin.visitAdminPage('post-new.php', 'post_type=post');
	await expect(page.locator('.extendify-library-modal')).toBeVisible({
		timeout: 15_000,
	});
	await page.getByTestId('modal-close-button').click();
});
