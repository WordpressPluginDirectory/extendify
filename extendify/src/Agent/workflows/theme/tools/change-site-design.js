import changeHeroSection from '@agent/workflows/theme/tools/change-hero-section';
import updateSiteVibes from '@agent/workflows/theme/tools/update-site-vibes';
import { deepMerge } from '@shared/lib/utils';
import apiFetch from '@wordpress/api-fetch';

const { globalStylesPostID } = window.extSharedData;

// Apply the selected variation as authoritative, preserving only block style variations (vibes)
const updateVariation = async ({ variation }) => {
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

	const final = deepMerge(variation, {
		styles: { blocks: preservedBlockVibes },
	});

	return apiFetch({
		method: 'POST',
		path: `/wp/v2/global-styles/${globalStylesPostID}`,
		data: { id: globalStylesPostID, ...final },
	});
};

export default async ({
	updatedPageBlocks,
	postId,
	vibeSlug,
	colorAndFontsVariation,
}) => {
	if (!updatedPageBlocks || !vibeSlug || !colorAndFontsVariation) return;

	await Promise.all([
		changeHeroSection({ updatedPageBlocks, postId }),
		(async () => {
			await updateSiteVibes({ selectedVibe: vibeSlug });
			await updateVariation({ variation: colorAndFontsVariation });
		})(),
	]);
};
