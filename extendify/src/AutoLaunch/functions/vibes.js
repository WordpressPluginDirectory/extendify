import {
	getGlobalStyles,
	updateGlobalStyles,
} from '@auto-launch/functions/theme';

export const updateNaturalVibeStyles = async (selectedVibe) => {
	if (
		!selectedVibe ||
		typeof selectedVibe !== 'string' ||
		selectedVibe.trim() === '' ||
		selectedVibe === 'natural-1'
	) {
		return;
	}

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

	try {
		// Fetch theme styles
		const { styles: themeStyles } = await getGlobalStyles();

		if (!themeStyles?.blocks) {
			throw new Error('No block styles found in theme global styles');
		}

		// Process blocks with variations
		const updatedBlocks = Object.fromEntries(
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

		// Apply the update
		await updateGlobalStyles({
			styles: { ...themeStyles, blocks: updatedBlocks },
		});
	} catch (error) {
		const errorMessage =
			error?.response?.data?.message || error?.message || 'Unknown error';
		throw new Error(`Vibe update failed: ${errorMessage}`);
	}
};
