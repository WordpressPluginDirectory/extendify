import { expect, test } from '../fixtures';

const seededArticleTitles = [
	'WordPress Block Editor',
	'Blocks List',
	'Adding a New Block',
	'Block Pattern',
	'Block Pattern Directory',
];

const addingBlockArticle = {
	slug: 'adding-a-new-block',
	title: 'Adding a New Block',
	content: '<p>How to add a new block to your post or page.</p>',
};

const codeBlockArticle = {
	slug: 'code-block',
	title: 'Code Block Article',
	content: '<p>The Code block lets you display formatted code snippets.</p>',
};

const codeBlockSearchHit = {
	id: 50,
	cats: ['blocks'],
	slug: 'code-block',
	title: codeBlockArticle.title,
	summary: 'A summary of the Code block article.',
};

test.beforeEach(async ({ admin, page, requestUtils }) => {
	await requestUtils.login();

	// Boot ping on focus, search POST per setSearchTerm ≥ 3 chars, single-
	// article GET on article mount. Globs would alias the `?` — use regex.
	await page.route(/\/api\/posts\?boot=true/, (route) =>
		route.fulfill({ status: 200, json: {} }),
	);
	await page.route(/\/api\/posts\?.*search=/, (route) =>
		route.fulfill({ status: 200, json: [codeBlockSearchHit] }),
	);
	await page.route(/\/api\/posts\/adding-a-new-block/, (route) =>
		route.fulfill({ status: 200, json: addingBlockArticle }),
	);
	await page.route(/\/api\/posts\/code-block/, (route) =>
		route.fulfill({ status: 200, json: codeBlockArticle }),
	);

	await admin.visitAdminPage('index.php');
	await page.getByTestId('help-center-adminbar-button').click();
});

test('KB section and articles list render on the dashboard', async ({
	page,
}) => {
	await expect(page.getByTestId('help-center-kb-section')).toBeAttached();
	await expect(
		page.getByTestId('help-center-kb-articles-list').locator('li'),
	).toHaveCount(seededArticleTitles.length);
});

test('Clicking an article opens the article page with the fetched content', async ({
	page,
}) => {
	const fetched = page.waitForResponse(/\/api\/posts\/adding-a-new-block/);
	await page
		.getByTestId('help-center-kb-articles-list')
		.locator('li')
		.filter({ hasText: addingBlockArticle.title })
		.first()
		.locator('button')
		.click();
	await fetched;

	await expect(page.getByTestId('kb-article-content')).toContainText(
		addingBlockArticle.title,
	);
});

test('Search returns results that open into an article', async ({ page }) => {
	const searchInput = page.locator('#ext-help-center-search');

	// `fill('code block')` on the dashboard's SearchForm fires one onChange
	// that both stores the term and navigates to the full KB page; the KB
	// page's useSearchArticles issues the POST on mount. The boot ping fires
	// on HC modal mount (i.e. during beforeEach), so we can't wait for it
	// here — `searched` is the next request the user-driven flow produces.
	const searched = page.waitForResponse(/\/api\/posts\?.*search=/);
	await searchInput.fill('code block');
	await searched;

	const fetched = page.waitForResponse(/\/api\/posts\/code-block/);
	await page
		.getByTestId('help-center-kb-articles-list')
		.locator('li')
		.filter({ hasText: codeBlockArticle.title })
		.first()
		.locator('button')
		.click();
	await fetched;

	await expect(page.getByTestId('kb-article-content')).toContainText(
		codeBlockArticle.title,
	);
});
