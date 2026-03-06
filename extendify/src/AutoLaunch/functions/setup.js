import apiFetch from '@wordpress/api-fetch';

export const prefetchAssistData = async () =>
	await apiFetch({ path: 'extendify/v1/auto-launch/prefetch-assist-data' });

export const postLaunchFunctions = () =>
	apiFetch({
		path: '/extendify/v1/launch/post-launch-functions',
		method: 'POST',
	});
