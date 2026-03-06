import { recordPluginActivity } from '@shared/api/DataApi';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

export const getActivePlugins = () =>
	apiFetch({ path: 'extendify/v1/auto-launch/active-plugins' });

export const alreadyActive = (activePlugins, pluginSlug) =>
	activePlugins?.filter((p) => p.includes(pluginSlug))?.length;

export const installPlugin = async (slug) => {
	const fn = async () => {
		const p = await apiFetch({
			path: '/wp/v2/plugins',
			method: 'POST',
			data: { slug },
		});
		await recordPluginActivity({ slug, source: 'auto-launch' });
		return p;
	};
	try {
		return await fn();
	} catch (error) {
		if (error?.code === 'folder_exists') {
			console.warn(
				`Plugin ${slug} already installed. Attempting to activate...`,
			);
			// Get the plugin info directly here
			return await getPlugin(slug);
		}
		console.error(`Error installing ${slug}. Retrying...`, error);
		try {
			return await fn();
		} catch (error) {
			console.error(`Failed ${slug} again. Giving up`, error);
		}
	}
};

export const getPlugin = async (slug) => {
	const response = await apiFetch({
		path: addQueryArgs('/wp/v2/plugins', { search: slug }),
	});
	return response?.[0];
};

export const activatePlugin = async (slug) => {
	const fn = (s) =>
		apiFetch({
			path: `/wp/v2/plugins/${s}`,
			method: 'POST',
			data: { status: 'active' },
		});

	try {
		await fn(slug);
	} catch (_) {
		console.warn(`Error activating ${slug}. Retrying with fresh data...`);
		// try once more but get the slug first
		const { plugin } = await getPlugin(slug);
		await fn(plugin);
	}
};

// Currently this only processes patterns with placeholders
// by swapping out the placeholders with the actual code
// returns the patterns as blocks with the placeholders replaced
export const replacePlaceholderPatterns = async (patterns) => {
	// Directly replace "blog-section" patterns using their replacement code, skipping the API call
	patterns = patterns.map((pattern) => {
		if (
			pattern.patternTypes.includes('blog-section') &&
			pattern.patternReplacementCode
		) {
			return {
				...pattern,
				code: pattern.patternReplacementCode,
			};
		}
		return pattern;
	});

	const hasPlaceholders = patterns.filter((p) => p.patternReplacementCode);
	if (!hasPlaceholders?.length) return patterns;

	const activePlugins =
		(await getActivePlugins())?.data?.map((path) => path.split('/')[0]) || [];

	const pluginsActivity = patterns
		.filter((p) => p.pluginDependency)
		.map((p) => p.pluginDependency)
		.filter((p) => !activePlugins.includes(p));

	for (const plugin of pluginsActivity) {
		recordPluginActivity({
			slug: plugin,
			source: 'auto-launch',
		});
	}

	try {
		return await processPlaceholders(patterns);
	} catch (_e) {
		// Try one more time (plugins installed may not be fully loaded)
		return await processPlaceholders(patterns)
			// If this fails, just return the original patterns
			.catch(() => patterns);
	}
};

export const processPlaceholders = (patterns) =>
	apiFetch({
		path: '/extendify/v1/shared/process-placeholders',
		method: 'POST',
		data: { patterns },
	});
