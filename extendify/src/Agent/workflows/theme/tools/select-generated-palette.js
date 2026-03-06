import apiFetch from '@wordpress/api-fetch';

const id = window.extSharedData.globalStylesPostID;

export default async ({ palette, duotone }) => {
	const currentStyles = await apiFetch({
		path: `/wp/v2/global-styles/${id}`,
	});

	const currentVibes = await apiFetch({
		path: '/extendify/v1/agent/block-style-variations',
	});

	const preservedBlocks = Object.keys(currentVibes).reduce(
		(blocks, blockName) => {
			blocks[blockName] = {
				...currentStyles.styles?.blocks?.[blockName],
				variations: currentVibes[blockName],
			};
			return blocks;
		},
		{},
	);

	const newPalette = palette.colors.map(({ slug, color, name }) => ({
		slug,
		color,
		name,
	}));

	const colorSettings = {
		...currentStyles.settings?.color,
		palette: {
			...currentStyles.settings?.color?.palette,
			theme: newPalette,
		},
	};

	if (duotone) {
		colorSettings.duotone = {
			...currentStyles.settings?.color?.duotone,
			theme: duotone,
		};
	}

	return apiFetch({
		method: 'POST',
		path: `/wp/v2/global-styles/${id}`,
		data: {
			id,
			settings: {
				...currentStyles.settings,
				color: colorSettings,
			},
			styles: {
				...currentStyles.styles,
				blocks: {
					...currentStyles.styles?.blocks,
					...preservedBlocks,
				},
			},
		},
	});
};
