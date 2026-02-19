import apiFetch from '@wordpress/api-fetch';

const globalStylesPostID = window.extSharedData?.globalStylesPostID;
const themeSlug = window.extAgentData?.context?.themeSlug;

export default async ({ selectedVibe }) => {
	if (
		!selectedVibe ||
		typeof selectedVibe !== 'string' ||
		selectedVibe.trim() === ''
	) {
		return;
	}

	try {
		// Fetch variation
		const { styles: variationStyles } = await apiFetch({
			path: `/wp/v2/global-styles/${globalStylesPostID}?context=edit`,
		});
		// Fetch theme styles
		const { styles: themeStyles } = await apiFetch({
			path: `/wp/v2/global-styles/themes/${themeSlug}?context=edit`,
		});

		const updatedBlocks = {};
		for (const [blockName, blockObj] of Object.entries(themeStyles.blocks)) {
			if (!blockObj?.variations) {
				updatedBlocks[blockName] = blockObj;
				continue;
			}

			const { variations, ...rest } = blockObj;
			updatedBlocks[blockName] = {
				...rest,
				variations: processBlockVariations(variations, selectedVibe),
			};
		}

		// Apply the update
		await Promise.all([
			apiFetch({
				path: `wp/v2/global-styles/${globalStylesPostID}`,
				method: 'POST',
				data: {
					styles: { ...variationStyles, blocks: updatedBlocks },
				},
			}),
			updateSiteStyleOption(selectedVibe),
		]);
	} catch (error) {
		const errorMessage =
			error?.response?.data?.message || error?.message || 'Unknown error';
		throw new Error(`Vibe update failed: ${errorMessage}`);
	}
};

const updateSiteStyleOption = async (selectedVibe) => {
	const { data: currentSiteStyle } = await apiFetch({
		path: '/extendify/v1/launch/options?option=extendify_siteStyle',
	});

	const existingSiteStyle =
		currentSiteStyle &&
		typeof currentSiteStyle === 'object' &&
		!Array.isArray(currentSiteStyle)
			? currentSiteStyle
			: {};

	const updatedSiteStyle = { ...existingSiteStyle, vibe: selectedVibe };

	return await apiFetch({
		path: '/extendify/v1/launch/options',
		method: 'POST',
		data: { option: 'extendify_siteStyle', value: updatedSiteStyle },
	});
};

const processBlockVariations = (variations, targetVibe) => {
	const updatedVariations = {};

	for (const [styleName, styleProperties] of Object.entries(variations)) {
		if (!styleName.includes('--natural-1--')) {
			updatedVariations[styleName] = styleProperties;
			continue;
		}

		const sourceStyleName = styleName.replace(
			'--natural-1--',
			`--${targetVibe}--`,
		);
		const sourceStyle = variations[sourceStyleName];

		updatedVariations[styleName] = sourceStyle || styleProperties;
	}

	return updatedVariations;
};
