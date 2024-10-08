import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { pages } from '@launch/lib/pages';

const store = (set, get) => ({
	pages: new Map(pages),
	currentPageIndex: 0,
	count: () => get().pages.size,
	getPageOrder: () => Array.from(get().pages.keys()),
	getCurrentPageData: () => get().pages.get(get().getCurrentPageSlug()),
	getCurrentPageSlug: () => {
		const page = get().getPageOrder()[get().currentPageIndex];
		if (!page) {
			get().setPage(0);
			return get().getPageOrder()[0];
		}
		return page;
	},
	getNextPageData: () => {
		const nextIndex = get().currentPageIndex + 1;
		if (nextIndex > get().count() - 1) return {};
		return get().pages.get(get().getPageOrder()[nextIndex]);
	},
	setPage: (page) => {
		// If page is a string, get the index
		if (typeof page === 'string') {
			page = get().getPageOrder().indexOf(page);
		}
		if (page > get().count() - 1) return;
		if (page < 0) return;
		set({ currentPageIndex: page });
	},
	removePage: (page) => {
		const thePage = get().pages.get(page);
		if (!thePage) return;
		const newPages = new Map();
		get().pages.forEach((value, key) => {
			if (key !== page) {
				newPages.set(key, value);
			}
		});
		set({ pages: newPages });
		// If the page has a cleanup function, run it
		thePage?.state?.getState()?.onRemove();
	},
	addPage: (page, data, after) => {
		// If the after page is not found, throw
		if (!get().pages.has(after)) {
			throw new Error(`Page ${after} not found`);
		}
		// If it already exists return
		if (get().pages.has(page)) return;
		const newPages = new Map();
		get().pages.forEach((value, key) => {
			newPages.set(key, value);
			if (key === after) {
				newPages.set(page, data);
			}
		});
		set({ pages: newPages });
	},
	pushHistory: (page) => {
		history.pushState(
			{
				currentPageIndex: page,
				currentPageKey: get().getPageOrder()[page],
				previousPageIndex: page - 1,
			},
			'',
		);
	},
	replaceHistory: (page) => {
		history.replaceState(
			{
				currentPageIndex: page,
				currentPageKey: get().getPageOrder()[page],
				previousPageIndex: page - 1,
			},
			'',
		);
	},
	nextPage: () => {
		const pageIndex = get().currentPageIndex + 1;
		get().pushHistory(pageIndex);
		get().setPage(pageIndex);
	},
	previousPage: () => {
		const pageIndex = get().currentPageIndex - 1;
		get().replaceHistory(pageIndex);
		get().setPage(pageIndex);
	},
});

const withDevtools = devtools(store, {
	name: 'Extendify Launch Pages',
	serialize: true,
});
const withPersist = persist(withDevtools, {
	name: `extendify-pages-${window.extSharedData.siteId}`,
	partialize: (state) => ({
		currentPageIndex: state?.currentPageIndex ?? 0,
		currentPageSlug: state?.getCurrentPageSlug() ?? null,
		availablePages: state?.getPageOrder() ?? [],
	}),
});
export const usePagesStore = create(withPersist);
