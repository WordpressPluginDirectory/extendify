import apiFetch from '@wordpress/api-fetch';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { safeParseJson } from '@help-center/lib/parsing';

const startingState = {
	articles: [],
	recentArticles: [],
	viewedArticles: [],
	searchTerm: '',
	// initialize the state with default values
	...(safeParseJson(window.extHelpCenterData.userData.supportArticlesData)
		?.state ?? {}),
};

const state = (set) => ({
	...startingState,
	pushArticle(article) {
		const { slug, title } = article;
		set((state) => {
			const lastViewedAt = new Date().toISOString();
			const firstViewedAt = lastViewedAt;
			const viewed = state.viewedArticles.find((a) => a.slug === slug);

			return {
				articles: [article, ...state.articles],
				recentArticles: [article, ...state.recentArticles.slice(0, 9)],
				viewedArticles: [
					// Remove the article if it's already in the list
					...state.viewedArticles.filter((a) => a.slug !== slug),
					// Either add the article or update the count
					viewed
						? { ...viewed, count: viewed.count + 1, lastViewedAt }
						: {
								slug,
								title,
								firstViewedAt,
								lastViewedAt,
								count: 1,
							},
				],
			};
		});
	},
	popArticle() {
		set((state) => ({ articles: state.articles.slice(1) }));
	},
	clearArticles() {
		set({ articles: [] });
	},
	reset() {
		set({ articles: [], searchTerm: '' });
	},
	updateTitle(slug, title) {
		// We don't always know the title until after we fetch the article data
		set((state) => ({
			articles: state.articles.map((article) => {
				if (article.slug === slug) {
					article.title = title;
				}
				return article;
			}),
		}));
	},
	clearSearchTerm() {
		set({ searchTerm: '' });
	},
	setSearchTerm(searchTerm) {
		set({ searchTerm });
	},
});

const path = '/extendify/v1/help-center/support-articles-data';
const storage = {
	getItem: async () => await apiFetch({ path }),
	setItem: async (_name, state) =>
		await apiFetch({ path, method: 'POST', data: { state } }),
};

export const useKnowledgeBaseStore = create(
	persist(devtools(state, { name: 'Extendify Help Center Knowledge Base' }), {
		storage: createJSONStorage(() => storage),
		skipHydration: true,
		partialize: (state) => {
			delete state.articles;
			delete state.searchTerm;
			return state;
		},
	}),
);
