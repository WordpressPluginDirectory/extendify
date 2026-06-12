// Hand-crafted minimal stubs for Launch's mid-flow AI / Patterns / Images
// endpoints. Not copies of cypress/fixtures/Launch/data/* — those are real API
// captures sized for assertions on response counts that were really just
// "whatever the fixture happened to contain at the time." These are sized to
// the smallest shape the WP plugin will parse and proceed.
//
// Later Launch phases extend this file (pageTemplatesStub, goalsStub) — only
// pre-bake what the current phase consumes.

const patternCode =
	'<!-- wp:paragraph --><p>Test pattern content</p><!-- /wp:paragraph -->';

export const siteProfileStub = {
	aiSiteType: 'Test Site Type',
	aiSiteCategory: 'Business',
	aiDescription: 'Test description.',
	aiKeywords: ['test'],
};

export const siteStringsStub = {
	aiHeaders: ['Headline'],
	aiBlogTitles: ['Blog Title'],
};

export const stylesStub = [
	{
		vibe: 'natural-1',
		fonts: { heading: 'inter', body: 'inter' },
		colorPalette: 'home-selection-stub-1',
	},
];

export const imagesStub = {
	siteImages: [
		{
			id: 1,
			url: 'https://images.extendify-cdn.com/demo-content/logos/ext-custom-logo-default.webp',
		},
	],
};

export const pageTemplatesStub = {
	recommended: [
		{
			slug: 'about',
			name: 'About',
			siteStyle: {
				vibe: 'natural-1',
				fonts: { heading: 'inter', body: 'inter' },
				colorPalette: 'page-select-stub',
			},
			patterns: [
				{
					name: 'about-stub',
					pluginDependency: null,
					patternMetadata: null,
					patternTypes: ['about-us'],
					vibes: ['natural-1'],
					patternReplacementCode: null,
					code: patternCode,
				},
			],
		},
		{
			slug: 'services',
			name: 'Services',
			siteStyle: {
				vibe: 'natural-1',
				fonts: { heading: 'inter', body: 'inter' },
				colorPalette: 'page-select-stub',
			},
			patterns: [
				{
					name: 'services-stub',
					pluginDependency: null,
					patternMetadata: null,
					patternTypes: ['services'],
					vibes: ['natural-1'],
					patternReplacementCode: null,
					code: patternCode,
				},
			],
		},
	],
	optional: [
		{
			slug: 'testimonials',
			name: 'Testimonials',
			siteStyle: {
				vibe: 'natural-1',
				fonts: { heading: 'inter', body: 'inter' },
				colorPalette: 'page-select-stub',
			},
			patterns: [
				{
					name: 'testimonials-stub',
					pluginDependency: null,
					patternMetadata: null,
					patternTypes: ['testimonials'],
					vibes: ['natural-1'],
					patternReplacementCode: null,
					code: patternCode,
				},
			],
		},
	],
};

// Cypress historically intercepted `${API_URL}/launch/goals*` with a real
// fixture. No live caller exists in the WP plugin today (no /launch/goals REST
// route is registered, no JS fetcher targets it) — the intercept is stale.
// Stubbed anyway to mirror the Cypress mock set; if a future
// caller resurfaces this endpoint, the shape matches the historical payload.
export const goalsStub = { data: [], success: true };

export const homeTemplatesStub = [
	{
		id: 'home-stub-1',
		slug: 'home',
		siteStyle: {
			vibe: 'natural-1',
			fonts: { heading: 'inter', body: 'inter' },
			colorPalette: 'home-selection-stub-1',
		},
		patterns: [
			{
				name: 'hero-stub-1',
				pluginDependency: null,
				patternMetadata: null,
				patternTypes: ['hero-header'],
				vibes: ['natural-1'],
				patternReplacementCode: null,
				code: patternCode,
			},
		],
	},
	{
		id: 'home-stub-2',
		slug: 'home',
		siteStyle: {
			vibe: 'natural-1',
			fonts: { heading: 'inter', body: 'inter' },
			colorPalette: 'home-selection-stub-2',
		},
		patterns: [
			{
				name: 'hero-stub-2',
				pluginDependency: null,
				patternMetadata: null,
				patternTypes: ['hero-header'],
				vibes: ['natural-1'],
				patternReplacementCode: null,
				code: patternCode,
			},
		],
	},
];
