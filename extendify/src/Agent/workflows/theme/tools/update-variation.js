import { deepMerge } from '@shared/lib/utils';
import apiFetch from '@wordpress/api-fetch';

const { globalStylesPostID } = window.extSharedData;

// Will merge into the current variation and preserve block style variations (vibes)
export default async ({ variation }) => {
	const currentTheme = await apiFetch({
		path: `/wp/v2/global-styles/${globalStylesPostID}?context=edit`,
	});
	const currentVariations = await apiFetch({
		path: '/extendify/v1/agent/block-style-variations',
	});

	const preservedBlockVibes = Object.keys(currentVariations).reduce(
		(blocks, blockName) => {
			blocks[blockName] = { variations: currentVariations[blockName] };
			return blocks;
		},
		{},
	);

	const final = deepMerge(currentTheme, variation, {
		styles: { blocks: preservedBlockVibes },
	});

	return apiFetch({
		method: 'POST',
		path: `/wp/v2/global-styles/${globalStylesPostID}`,
		data: { id: globalStylesPostID, ...final },
	});
};
