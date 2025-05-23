import { extractPluginSlugs } from '@recommendations/utils/extract-plugin-slugs';
import { getAllPlugins } from '@shared/api/wp';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/* global jQuery */

const state = (set, get) => ({
	query: null,
	searchPlugins: [],
	installedPlugins: [],
	searchPluginsLimit: 6,
	recommendationsLimit: 2,
	isSearchPluginsLoading: false,
	isSearchPluginsError: false,
	isInstalledPluginsLoading: false,
	isInstalledPluginsError: false,
	initialize: () => {
		get().startListeningToAjax();
		get().fetchInstalledPlugins();
	},
	startListeningToAjax: () => {
		// Initial query is present if the page loaded is already a search.
		const initialQuery = new URLSearchParams(window.location.search).get('s');

		if (initialQuery) {
			const searchResults = document.getElementById('plugin-filter');
			const pluginSlugs = extractPluginSlugs(searchResults);

			set({
				query: initialQuery,
				searchPlugins: pluginSlugs,
			});
		}

		const parser = new DOMParser();

		jQuery?.ajaxSetup({
			beforeSend: (_, settings) => {
				const params = new URLSearchParams(settings.data);
				const action = params.get('action');
				const search = params.get('s');

				if (action !== 'search-install-plugins') {
					return;
				}

				settings.success = (data) => {
					try {
						const parsedData = parser.parseFromString(
							data.data.items,
							'text/html',
						);
						const pluginSlugs = extractPluginSlugs(parsedData);

						set({
							searchPlugins: pluginSlugs,
							isSearchPluginsLoading: false,
							isSearchPluginsError: false,
						});
					} catch (error) {
						set({
							searchPlugins: [],
							isSearchPluginsLoading: false,
							isSearchPluginsError: true,
						});
					}
				};

				settings.error = () => {
					set({
						searchPlugins: [],
						isSearchPluginsLoading: false,
						isSearchPluginsError: true,
					});
				};

				set({
					query: search ? search : null,
					searchPlugins: [],
					isSearchPluginsLoading: search ? true : false,
					isSearchPluginsError: false,
				});
			},
		});
	},
	fetchInstalledPlugins: async (force = false) => {
		if (get().installedPlugins.length && !force) {
			return;
		}

		try {
			set({
				isInstalledPluginsLoading: true,
				isInstalledPluginsError: false,
			});

			// Fetch installed plugins.
			const data = await getAllPlugins();

			set({
				installedPlugins: data?.map((plugin) => ({
					// We are extracting only the slug because the `plugin` value
					// looks like `plugin-slug/plugin-file-name`.
					slug: plugin.plugin.split('/')[0],
					status: plugin.status,
				})),
				isInstalledPluginsLoading: false,
				isInstalledPluginsError: false,
			});
		} catch (_) {
			set({
				installedPlugins: [],
				isInstalledPluginsLoading: false,
				isInstalledPluginsError: true,
			});
		}
	},
});

const createInitializedStore = () => {
	const store = create(devtools(state, { name: 'Extendify Plugin Search' }));
	store.getState().initialize();
	return store;
};

export const usePluginSearchStore = createInitializedStore();
