import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

export const getImages = async () => {
	const images = await apiFetch({
		method: 'GET',
		path: addQueryArgs('/extendify/v1/page-creator/settings/get-option', {
			name: 'user_selections',
			item: 'siteImages',
		}),
	});

	if (images?.siteImages?.length) return images;

	return [];
};

export const getSiteStyle = async () => {
	const siteStyles = await apiFetch({
		method: 'GET',
		path: addQueryArgs('/extendify/v1/page-creator/settings/get-option', {
			name: 'extendify_siteStyle',
		}),
	});

	if (siteStyles) return siteStyles;

	return { vibe: 'standard' };
};

export const updateOption = async (option, value) =>
	await apiFetch({
		path: '/extendify/v1/page-creator/settings/single',
		method: 'POST',
		data: { key: option, value },
	});
