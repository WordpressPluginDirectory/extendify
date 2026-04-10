import { apiFetchWithTimeout } from '@auto-launch/functions/helpers';
import { deepMerge } from '@shared/lib/utils';

// TODO: add zod types - this was copy/pasted from legacy launch
export const getThemeVariation = async ({ slug, fonts }, opts) => {
	const { fallback = false } = opts || {};
	const rawVariations = await apiFetchWithTimeout({
		path: 'wp/v2/global-styles/themes/extendable/variations',
	});

	const variations = rawVariations.filter(
		(v) =>
			(v.settings?.color || v.styles?.color) &&
			(v.settings?.typography || v.styles?.typography),
	);

	let variation = variations.find((v) => {
		const matchSlug =
			v.slug || v.title.toLowerCase().trim().replace(/\s+/g, '-');
		return matchSlug === slug;
	});

	// Fallback to random variation if slug doesn't match
	if (!variation && fallback) {
		variation = variations.sort(() => Math.random() - 0.5)[0];
	}

	if (!fonts) return variation;

	return deepMerge(variation, {
		styles: {
			elements: {
				heading: {
					typography: {
						fontFamily: `var(--wp--preset--font-family--${fonts.heading.slug})`,
					},
				},
			},
			typography: {
				fontFamily: `var(--wp--preset--font-family--${fonts.body.slug})`,
			},
		},
		settings: {
			typography: {
				fontFamilies: {
					custom: [fonts.heading, fonts.body].filter((font) => !!font.host),
				},
			},
		},
	});
};
