import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect } from '@wordpress/element';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { safeParseJson } from '@help-center/lib/parsing';
import { routes as aiRoutes } from '@help-center/pages/AIChat';
import { routes as dashRoutes } from '@help-center/pages/Dashboard';
import { routes as kbRoutes } from '@help-center/pages/KnowledgeBase';
import { routes as tourRoutes } from '@help-center/pages/Tours';

const pages = [...dashRoutes, ...kbRoutes, ...tourRoutes, ...aiRoutes];

const state = (set, get) => ({
	history: [],
	viewedPages: [],
	current: null,
	// initialize the state with default values
	...(safeParseJson(window.extHelpCenterData.userData)?.state ?? {}),
	goBack: () => {
		if (get().history.length < 2) return;
		set((state) => ({
			history: state.history.slice(1),
			current: get().history[1],
		}));
	},
	setCurrent: (page) => {
		if (!page) return;
		// If history is the same, dont add (they pressed the same button)
		if (get().history[0]?.slug === page.slug) return;
		set((state) => {
			const lastViewedAt = new Date().toISOString();
			const firstViewedAt = lastViewedAt;
			const visited = state.viewedPages.find((a) => a.slug === page.slug);
			return {
				history: [page, ...state.history].filter(Boolean),
				current: page,
				viewedPages: [
					// Remove the page if it's already in the list
					...state.viewedPages.filter((a) => a.slug !== page.slug),
					// Either add the page or update the count
					visited
						? { ...visited, count: visited.count + 1, lastViewedAt }
						: {
								slug: page.slug,
								firstViewedAt,
								lastViewedAt,
								count: 1,
							},
				],
			};
		});
	},
});

const path = '/extendify/v1/help-center/router-data';
const storage = {
	getItem: async () => await apiFetch({ path }),
	setItem: async (_name, state) =>
		await apiFetch({ path, method: 'POST', data: { state } }),
};

const useRouterState = create(
	persist(devtools(state, { name: 'Extendify Help Center Router' }), {
		name: 'extendify-help-center-router',
		storage: createJSONStorage(() => storage),
		skipHydration: true,
		partialize: ({ viewedPages }) => ({ viewedPages }),
	}),
);

export const useRouter = () => {
	const { current, setCurrent, history, goBack } = useRouterState();
	const Component = current?.component ?? (() => null);
	useEffect(() => {
		if (current) return;
		setCurrent(pages[0]);
	}, [current, setCurrent]);
	return {
		current,
		CurrentPage: useCallback(
			() => (
				<div role="region" aria-live="polite" className="h-full">
					{/* Announce to SR on change */}
					<h1 className="sr-only">{current?.title}</h1>
					<Component />
				</div>
			),
			[current],
		),
		navigateTo: (slug) => {
			const page = pages.find((a) => a.slug === slug);
			setCurrent(page ?? pages[0]);
		},
		goBack,
		history,
	};
};
