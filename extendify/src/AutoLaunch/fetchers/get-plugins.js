import { getPluginsShape, pluginShape } from '@auto-launch/fetchers/shape';
import {
	failWithFallback,
	fetchWithTimeout,
	retryTwice,
	setStatus,
} from '@auto-launch/functions/helpers';
import {
	activatePlugin,
	alreadyActive,
	getActivePlugins,
	installPlugin,
} from '@auto-launch/functions/plugins';
import { AI_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';
import { __ } from '@wordpress/i18n';
import { z } from 'zod';

const { pluginGroupId } = window.extSharedData;
const fallback = { sitePlugins: [] };
const url = `${AI_HOST}/api/site-plugins`;
const method = 'POST';
const headers = { 'Content-Type': 'application/json' };

// Local due to legacy naming inconsistency
const shapeLocal = z.object({
	selectedPlugins: z.array(pluginShape),
});

export const handleSitePlugins = async ({
	siteProfile = {},
	requiredOnly = false,
	showStatus = true,
}) => {
	if (showStatus) {
		// translators: this is for a action log UI. Keep it short
		setStatus(__('Setting up site functionality', 'extendify-local'));
	}

	const body = JSON.stringify({
		...reqDataBasics,
		...siteProfile,
		siteProfile,
		siteObjective: siteProfile.objective,
		pluginGroupId,
		requiredOnly,
	});

	const response = await retryTwice(() =>
		fetchWithTimeout(url, { method, headers, body }),
	);

	if (!response?.ok) return fallback;

	const plugins = await failWithFallback(async () => {
		const data = await response.json();
		const sitePlugins = shapeLocal
			.parse(data)
			.selectedPlugins // We add give to the front. See here why:
			// https://github.com/extendify/company-product/issues/713
			.toSorted(({ wordpressSlug }) => (wordpressSlug === 'give' ? -1 : 1));
		return getPluginsShape.parse({ sitePlugins });
	}, fallback);

	// install partner plugins
	const activePlugins = await getActivePlugins();
	const pluginsToInstall = plugins.sitePlugins.filter(
		({ wordpressSlug: slug }) => !alreadyActive(activePlugins, slug),
	);
	if (showStatus && pluginsToInstall.length > 0) {
		setStatus(
			// translators: this is for a action log UI. Keep it short
			__('Setting up functionality for your website', 'extendify-local'),
		);
	}
	for (const { wordpressSlug: slug } of pluginsToInstall) {
		const p = await installPlugin(slug);
		await activatePlugin(p?.plugin ?? slug);
	}
	return plugins;
};
