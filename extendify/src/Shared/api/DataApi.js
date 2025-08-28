import apiFetch from '@wordpress/api-fetch';
import { INSIGHTS_HOST } from '@constants';
import { extraBody } from '@shared/lib/extra-body';

export const recordPluginActivity = async ({
	slug,
	source,
	action = 'install', //eslint-disable-line no-unused-vars
}) => {
	try {
		const res = await fetch(`${INSIGHTS_HOST}/api/v1/plugin-install`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Extendify': 'true' },
			body: JSON.stringify({
				...extraBody,
				slug,
				source,
				siteCreatedAt: window.extSharedData?.siteCreatedAt,
			}),
		});

		// this should not break the app.
		if (!res.ok) {
			console.error('Bad response from server');
			return null;
		}

		return await res.json();
	} catch (error) {
		console.error('Error sending plugin installation notification:', error);
		return null;
	}
};

export const pingServer = async () =>
	await apiFetch({ path: '/extendify/v1/shared/ping' });

export const getPartnerPlugins = async (key) => {
	const plugins = await apiFetch({
		path: '/extendify/v1/shared/partner-plugins',
	});
	if (!Object.keys(plugins?.data ?? {}).length) {
		throw new Error('Could not get plugins');
	}
	if (key && plugins.data?.[key]) {
		return plugins.data[key];
	}
	return plugins.data;
};
