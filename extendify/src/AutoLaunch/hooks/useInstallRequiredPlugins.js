import { handleSitePlugins } from '@auto-launch/fetchers/get-plugins';
import { activatePlugin, installPlugin } from '@auto-launch/functions/plugins';
import { useEffect, useRef } from '@wordpress/element';
import useSWR from 'swr/immutable';

const { installedPluginsSlugs } = window.extSharedData || {};

export const useInstallRequiredPlugins = () => {
	const { data, error } = useSWR('required-plugins', () =>
		handleSitePlugins({ requiredOnly: true }),
	);
	const started = useRef(false);

	useEffect(() => {
		if (started.current || !data?.sitePlugins?.length) return;
		started.current = true;
		const install = async () => {
			for (const { wordpressSlug: slug } of data.sitePlugins) {
				// One plugin failing shouldn't block the rest of the required set.
				try {
					let plugin;
					if (!installedPluginsSlugs?.includes(slug)) {
						plugin = await installPlugin(slug);
					}
					await activatePlugin(plugin?.plugin ?? slug);
				} catch (error) {
					console.error(`Failed to set up required plugin ${slug}`, error);
				}
			}
		};
		install();
	}, [data]);

	return {
		requiredPlugins: data?.selectedPlugins || [],
		isLoading: !error && !data,
		isError: error,
	};
};
