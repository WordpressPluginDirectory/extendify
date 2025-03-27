import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

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
