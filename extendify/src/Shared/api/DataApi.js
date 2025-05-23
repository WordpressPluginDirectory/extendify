import apiFetch from '@wordpress/api-fetch';

export const pingServer = async () =>
	await apiFetch({ path: '/extendify/v1/shared/ping' });

export const getPartnerPlugins = async (key) => {
	const plugins = await apiFetch({
		path: '/extendify/v1/shared/partner-plugins',
	});
	if (!Object.keys(plugins?.data ?? {}).length) {
		throw new Error('Could not get plugins');
	}
	if (key && plugins.data[key].length) {
		return plugins.data[key];
	}
	return plugins.data;
};
