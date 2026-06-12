import { addPageLinksToNav } from '@launch/api/WPApi';

// Mock @wordpress/api-fetch to prevent actual API calls
let capturedNavContent = null;
jest.mock('@wordpress/api-fetch', () =>
	jest.fn((options) => {
		if (options.path?.includes('navigation')) {
			capturedNavContent = options.data?.content || '';
		}
		return Promise.resolve({});
	}),
);

// Helper to create a mock page object (created pages use originalSlug)
const createPage = (slug, id = Math.random(), isPlugin = false) => {
	const data = {
		id,
		title: { rendered: slug.charAt(0).toUpperCase() + slug.slice(1) },
		link: `https://example.com/${slug}`,
		type: 'page',
	};
	return isPlugin ? { ...data, slug } : { ...data, originalSlug: slug };
};

// Helper to extract page labels from the navigation content
const extractLabels = (navContent) => {
	const matches = navContent.matchAll(/"label":"([^"]+)"/g);
	return [...matches].map((m) => m[1]);
};

// Helper to extract top-level labels (outside submenu blocks)
const extractTopLevelLabels = (navContent) => {
	const withoutSubmenus = navContent.replace(
		/<!-- wp:navigation-submenu[\s\S]*?<!-- \/wp:navigation-submenu -->/g,
		'',
	);
	return extractLabels(withoutSubmenus);
};

// Helper to extract submenu labels
const extractSubmenuLabels = (navContent) => {
	const submenuMatch = navContent.match(
		/<!-- wp:navigation-submenu[\s\S]*?<!-- \/wp:navigation-submenu -->/,
	);
	return submenuMatch ? extractLabels(submenuMatch[0]) : [];
};

describe('addPageLinksToNav', () => {
	beforeEach(() => {
		capturedNavContent = null;
	});

	describe('sorting by navOrder', () => {
		it('should sort pages by their navOrder', async () => {
			const allPages = [
				{ slug: 'about' }, // navOrder: 19
				{ slug: 'services' }, // navOrder: 1
				{ slug: 'contact' }, // navOrder: 5
				{ slug: 'pricing' }, // navOrder: 4
			];
			const createdPages = allPages.map((p) => createPage(p.slug));

			await addPageLinksToNav('nav-1', allPages, createdPages);

			const labels = extractLabels(capturedNavContent);
			// Sorted by navOrder: Services (1), Pricing (4), About (19)
			expect(labels).toEqual(['Services', 'Pricing', 'About', 'Contact']);
		});

		it('should resolve plugin page slugs via aliases (e.g., shop -> products)', async () => {
			const allPages = [{ slug: 'services' }, { slug: 'about' }];
			const createdPages = [createPage('services'), createPage('about')];
			const pluginPages = [createPage('shop', null, true)]; // shop is alias for products (navOrder: 2)

			await addPageLinksToNav('nav-1', allPages, createdPages, pluginPages);

			const labels = extractLabels(capturedNavContent);
			// Services (1), Shop/Products (2), About (19)
			expect(labels).toEqual(['Services', 'Shop', 'About']);
		});

		it('should place unknown slugs after sorted pages but before contact', async () => {
			const allPages = [{ slug: 'services' }, { slug: 'contact' }];
			const createdPages = [createPage('services'), createPage('contact')];
			const pluginPages = [
				createPage('unknown-a', null, true),
				createPage('unknown-b', null, true),
			];

			await addPageLinksToNav('nav-1', allPages, createdPages, pluginPages);

			const labels = extractLabels(capturedNavContent);
			// Services (1), then unknowns (maxOrder), then Contact (always last)
			expect(labels).toEqual(['Services', 'Unknown-a', 'Unknown-b', 'Contact']);
		});
	});

	describe('contact page positioning', () => {
		it('should place contact at end when 6 or fewer pages (no submenu)', async () => {
			const allPages = [
				{ slug: 'services' }, // 1
				{ slug: 'products' }, // 2
				{ slug: 'book' }, // 3
				{ slug: 'pricing' }, // 4
				{ slug: 'about' }, // 19
				{ slug: 'contact' }, // moved to last
			];
			const createdPages = allPages.map((p) => createPage(p.slug));

			await addPageLinksToNav('nav-1', allPages, createdPages);

			const labels = extractLabels(capturedNavContent);

			// All 6 should be top-level with contact last
			expect(labels).toEqual([
				'Services',
				'Products',
				'Book',
				'Pricing',
				'About',
				'Contact',
			]);
			expect(labels[5]).toBe('Contact');

			// No submenu when exactly 6 pages
			expect(capturedNavContent).not.toContain('wp:navigation-submenu');
		});

		it('should place contact at index 4 with remaining pages in submenu when 7+ pages', async () => {
			const allPages = [
				{ slug: 'services' }, // 1
				{ slug: 'products' }, // 2
				{ slug: 'book' }, // 3
				{ slug: 'pricing' }, // 4
				{ slug: 'blog' }, // 18
				{ slug: 'about' }, // 19
				{ slug: 'contact' }, // moved to 5th (index 4)
			];
			const createdPages = allPages.map((p) => createPage(p.slug));

			await addPageLinksToNav('nav-1', allPages, createdPages);

			const topLevelLabels = extractTopLevelLabels(capturedNavContent);
			const submenuLabels = extractSubmenuLabels(capturedNavContent);

			// Top 5: Services, Products, Book, Pricing, Contact (promoted to last top-level)
			expect(topLevelLabels).toHaveLength(5);
			expect(topLevelLabels).toEqual([
				'Services',
				'Products',
				'Book',
				'Pricing',
				'Contact',
			]);
			expect(topLevelLabels[4]).toBe('Contact');

			// Submenu should contain remaining pages (Blog, About) plus "More" label
			expect(capturedNavContent).toContain('wp:navigation-submenu');
			expect(submenuLabels).toContain('More');
			expect(submenuLabels).toContain('Blog');
			expect(submenuLabels).toContain('About');

			// Contact should NOT be in submenu
			expect(submenuLabels).not.toContain('Contact');
		});

		it('should handle case when no contact page exists', async () => {
			const allPages = [
				{ slug: 'services' },
				{ slug: 'products' },
				{ slug: 'about' },
			];
			const createdPages = allPages.map((p) => createPage(p.slug));

			await addPageLinksToNav('nav-1', allPages, createdPages);

			const labels = extractLabels(capturedNavContent);
			expect(labels).toEqual(['Services', 'Products', 'About']);
			expect(labels).not.toContain('Contact');
		});

		it('should recognize contact page by alias (contact-form)', async () => {
			const allPages = [{ slug: 'services' }, { slug: 'about' }];
			const createdPages = [createPage('services'), createPage('about')];
			const pluginPages = [createPage('contact-form', null, true)]; // alias for contact

			await addPageLinksToNav('nav-1', allPages, createdPages, pluginPages);

			const labels = extractLabels(capturedNavContent);
			// Contact-form should be treated as contact and placed last
			expect(labels).toEqual(['Services', 'About', 'Contact-form']);
			expect(labels[labels.length - 1]).toBe('Contact-form');
		});
	});

	describe('edge cases', () => {
		it('should handle empty pages array', async () => {
			await addPageLinksToNav('nav-1', [], []);

			expect(capturedNavContent).toBe('');
		});

		it('should exclude home page from navigation', async () => {
			const allPages = [
				{ slug: 'home' },
				{ slug: 'services' },
				{ slug: 'contact' },
			];
			const createdPages = allPages.map((p) => createPage(p.slug));

			await addPageLinksToNav('nav-1', allPages, createdPages);

			const labels = extractLabels(capturedNavContent);
			expect(labels).not.toContain('Home');
			expect(labels).toEqual(['Services', 'Contact']);
		});
	});
});
