import blockStyleVariations from '@launch/_data/block-style-variations.json';
import apiFetch from '@wordpress/api-fetch';
import useSWRImmutable from 'swr/immutable';

export const useSiteVibesVariations = () => {
	const { data, error, isLoading } = useSWRImmutable(
		{
			key: 'site-vibes-variations',
			themeSlug: window.extAgentData.context.themeSlug,
		},
		fetcher,
	);
	return { data, error, isLoading };
};

const fetcher = async () => {
	const stylesResponse = await apiFetch({
		path: '/wp/v2/global-styles/themes/extendable?context=edit',
	});

	const styles = stylesResponse?.styles;
	if (!styles?.blocks) return null;

	const optionsResponse = await apiFetch({
		path: '/extendify/v1/launch/options?option=extendify_siteStyle',
	});

	const currentVibe = optionsResponse?.data?.vibe;

	return {
		vibes: extractVibesFromTheme(styles),
		css: { ...blockStyleVariations },
		currentVibe: currentVibe || 'natural-1',
	};
};

const extractVibesFromTheme = (themeStyles) => {
	if (!themeStyles?.blocks) return [];

	const vibeSet = new Set();
	const { blocks } = themeStyles;

	// Scan all blocks for vibe variations
	for (const blockObj of Object.values(blocks)) {
		if (!blockObj?.variations) continue;

		for (const styleName of Object.keys(blockObj.variations)) {
			if (!styleName.startsWith('ext-preset--')) continue;

			// Split the slug: ext-preset--group--gradient-1--item-card-1--align-center
			const parts = styleName.split('--');

			if (parts.length >= 4) {
				const vibe = parts[2]; // 'gradient-1' ← This is what we want!
				if (vibe) vibeSet.add(vibe);
			}
		}
	}

	return Array.from(vibeSet).map((slug) => ({
		name: slugToDisplayName(slug), // "gradient-1" → "Gradient 1"
		slug,
	}));
};

const slugToDisplayName = (slug) =>
	slug
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
