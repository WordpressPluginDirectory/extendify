// e2e:disabled
import { expect, test } from '../../fixtures';
import { pageTemplatesStub } from '../_mocks';

const stubStyle = {
	id: 'home-stub',
	slug: 'home',
	siteStyle: {
		vibe: 'natural-1',
		fonts: { heading: 'inter', body: 'inter' },
		colorPalette: 'page-select-stub',
	},
	patterns: [
		{
			name: 'hero-stub',
			pluginDependency: null,
			patternMetadata: null,
			patternTypes: ['hero-header'],
			vibes: ['natural-1'],
			patternReplacementCode: null,
			code: '<!-- wp:paragraph --><p>Test pattern content</p><!-- /wp:paragraph -->',
		},
	],
};

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();

	// usePagesStore persists currentPageIndex/currentPageSlug to localStorage
	// (key: `extendify-pages-${siteId}`). usePagesSelectionStore holds the
	// chosen home style (key: `extendify-launch-pages-selection-${siteId}`).
	// PagesSelect reads style.patterns for the home preview and style.siteStyle
	// flows into the page-templates request via buildRecommendedPagesParams.
	// Blueprints can't touch localStorage; addInitScript runs before any page
	// script — no runtime mutation.
	await page.addInitScript((style) => {
		window.localStorage.setItem(
			'extendify-pages-12345',
			JSON.stringify({
				state: { currentPageIndex: 6, currentPageSlug: 'page-select' },
				version: 0,
			}),
		);
		window.localStorage.setItem(
			'extendify-launch-pages-selection-12345',
			JSON.stringify({ state: { style }, version: 0 }),
		);
	}, stubStyle);

	await page.route('**/api/page-templates*', (route) =>
		route.fulfill({ status: 200, json: pageTemplatesStub }),
	);

	await admin.visitAdminPage('admin.php', 'page=extendify-launch');
});

test('renders recommended pages auto-selected and reveals optional pages on expand', async ({
	page,
}) => {
	await expect(
		page.getByRole('heading', {
			name: /Pick the pages to add to your website/i,
		}),
	).toBeVisible();

	const recommended = page.getByTestId('recommended-pages');

	// Home page is always rendered, force-checked and disabled.
	await expect(recommended.getByLabel('Home page')).toBeChecked();
	await expect(recommended.getByLabel('Home page')).toBeDisabled();

	// Each stub recommended page renders and is auto-selected on mount
	// (PagesSelect's effect adds recommended pages once the fetch resolves).
	for (const item of pageTemplatesStub.recommended) {
		await expect(recommended.getByLabel(item.name)).toBeChecked();
	}

	// Optional section is hidden until expand-more is clicked.
	await expect(page.getByTestId('optional-pages')).toHaveCount(0);

	await page.getByTestId('expand-more').click();

	const optional = page.getByTestId('optional-pages');
	for (const item of pageTemplatesStub.optional) {
		await expect(optional.getByLabel(item.name)).toBeVisible();
		await expect(optional.getByLabel(item.name)).not.toBeChecked();
	}
});
