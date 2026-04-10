import { getGlobalStyles } from '@auto-launch/functions/theme';

const isValidVibe = (selectedVibe) =>
	!!selectedVibe &&
	typeof selectedVibe === 'string' &&
	selectedVibe.trim() !== '' &&
	selectedVibe !== 'natural-1';

const generateSourceStyleName = (naturalStyleName, targetVibe) =>
	naturalStyleName.replace('--natural-1--', `--${targetVibe}--`);

const processBlockVariations = (variations, targetVibe) =>
	Object.fromEntries(
		Object.entries(variations).map(([styleName, styleProperties]) => {
			if (!styleName.includes('--natural-1--')) {
				return [styleName, { ...styleProperties }];
			}

			const sourceStyleName = generateSourceStyleName(styleName, targetVibe);
			const sourceStyle = variations[sourceStyleName];

			return [
				styleName,
				sourceStyle ? { ...sourceStyle } : { ...styleProperties },
			];
		}),
	);

// Compute the vibe-adjusted blocks from the theme's global styles.
// Returns the blocks object (ready to merge into a variation) without
// POSTing anything. Callers should merge the result into the variation's
// styles before calling updateVariation — doing it this way avoids a
// separate POST that would overwrite the fonts, colors and other style
// overrides already set in the variation.
export const computeVibeAdjustedBlocks = async (selectedVibe) => {
	if (!isValidVibe(selectedVibe)) return null;

	const { styles: themeStyles } = await getGlobalStyles();
	if (!themeStyles?.blocks) return null;

	return Object.fromEntries(
		Object.entries(themeStyles.blocks).map(([blockName, blockObj]) => {
			if (!blockObj?.variations) {
				return [blockName, blockObj];
			}

			const { variations, ...rest } = blockObj;
			const hasNaturalVariations = Object.keys(variations).some((styleName) =>
				styleName.includes('--natural-1--'),
			);

			if (!hasNaturalVariations) {
				return [blockName, blockObj];
			}

			return [
				blockName,
				{
					...rest,
					variations: processBlockVariations(variations, selectedVibe),
				},
			];
		}),
	);
};
