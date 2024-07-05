import { generateCustomPatterns } from '@launch/api/DataApi';
import {
	updateOption,
	createPage,
	updateThemeVariation,
} from '@launch/api/WPApi';

export const createWpPages = async (pages) => {
	const pageIds = [];
	for (const page of pages) {
		const newPage = await createPage({
			title: page.name,
			status: 'publish',
			content: (page.patterns || []).map(({ code }) => code).join(''),
			template: 'no-title',
			meta: { made_with_extendify_launch: true },
		});
		pageIds.push({ ...newPage, originalSlug: page.slug });
	}

	// When we have home, set reading setting
	const maybeHome = pageIds.find(({ originalSlug }) => originalSlug === 'home');
	if (maybeHome) {
		await updateOption('show_on_front', 'page');
		await updateOption('page_on_front', maybeHome.id);
	}

	// When we have blog, set reading setting
	const maybeBlog = pageIds.find(({ originalSlug }) => originalSlug === 'blog');
	if (maybeBlog) {
		await updateOption('page_for_posts', maybeBlog.id);
	}

	return pageIds;
};

export const generateCustomPageContent = async (pages, userState) => {
	// Either didn't see the ai copy page or skipped it
	if (!userState.businessInformation.description) {
		return pages;
	}

	const { siteId, partnerId, wpLanguage, wpVersion } = window.extSharedData;

	const result = await Promise.allSettled(
		pages.map((page) =>
			generateCustomPatterns(page, {
				...userState,
				siteId,
				partnerId,
				siteVersion: wpVersion,
				language: wpLanguage,
			})
				.then((response) => response)
				.catch(() => page),
		),
	);

	return result?.map((page, i) => page.value || pages[i]) || pages;
};

export const updateGlobalStyleVariant = (variation) =>
	updateThemeVariation(window.extSharedData.globalStylesPostID, variation);
