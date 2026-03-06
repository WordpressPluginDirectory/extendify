import { apiFetchWithTimeout } from '@auto-launch/functions/helpers';
import { deepMerge } from '@shared/lib/utils';

// TODO: add zod types - this was copy/pasted from legacy launch
export const getThemeVariation = async ({ slug, fonts }, opts) => {
	const { fallback = false } = opts || {};
	const variations = await apiFetchWithTimeout({
		path: 'wp/v2/global-styles/themes/extendable/variations',
	});

	let variation = variations.find((v) => {
		const matchSlug =
			v.slug || v.title.toLowerCase().trim().replace(/\s+/g, '-');
		return matchSlug === slug; // TODO: why is rio breaking?
	});

	const settingsKeys = Object.keys(variation.settings || {});
	const stylesKeys = Object.keys(variation.styles || {});
	const combinedKeys = new Set([...settingsKeys, ...stylesKeys]);

	if (!combinedKeys.has('color') || !combinedKeys.has('typography')) {
		variation = null;
	}

	// This isn't great but picking a random one is better than nothing
	// I've seen cases where the variation is missing color or typography
	if (!variation && fallback) {
		variation = variations
			.sort(() => Math.random() - 0.5)
			.find((v) => {
				const sKeys = Object.keys(v.settings || {});
				const tKeys = Object.keys(v.styles || {});
				const keys = new Set([...sKeys, ...tKeys]);
				return keys.has('color') && keys.has('typography');
			});
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
