import { AI_HOST } from '@constants';
import useSWRImmutable from 'swr/immutable';

export const ACTIVATION_STATUS = {
	displayed: 'displayed',
	completed: 'completed',
	skipped: 'skipped',
};

const getPluginsScriptData = async (slugs) => {
	const params = new URLSearchParams(slugs.map((slug) => ['plugins', slug]));
	params.append('siteId', window.extSharedData.siteId);
	params.append('partnerId', window.extSharedData.partnerId);

	const response = await fetch(`${AI_HOST}/api/plugins/activate?${params}`);
	return response.json();
};

const patchActivation = async ({
	activationId,
	selectedPlugins,
	status,
	context,
}) => {
	await fetch(`${AI_HOST}/api/plugins/activate`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ activationId, selectedPlugins, status, context }),
	});
};

export const usePluginsActivation = (plugins) => {
	const slugs = plugins.map((plugin) => plugin.slug);
	const {
		data,
		isLoading: loading,
		error,
	} = useSWRImmutable(slugs, getPluginsScriptData);
	const { activationId, ...scriptData } = data ?? {};

	const selectedPlugins = plugins
		.filter((plugin) => plugin.selected)
		.map((plugin) => plugin.slug);

	const activatePlugins = ({ status, context = undefined }) =>
		patchActivation({ activationId, selectedPlugins, status, context });

	return { scriptData, activatePlugins, loading, error };
};
