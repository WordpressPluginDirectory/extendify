import apiFetch from '@wordpress/api-fetch';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

const path = '/extendify/v1/draft/user-settings';
const storage = {
	getItem: async () => await apiFetch({ path }),
	setItem: async (_name, state) =>
		await apiFetch({ path, method: 'POST', data: { state } }),
};
// Values added here should also be added to Admin.php ln ~200
const startingState = {
	imageCredits: {
		remaining: 10,
		total: 10,
		refresh: undefined,
	},
};
const store = (set) => ({
	...startingState,
	...(window.extDraftData?.globalState?.state ?? {}),
	updateImageCredits({ remaining, total, refresh }) {
		set((state) => ({
			imageCredits: {
				...state.imageCredits,
				// Only update truthy values
				...(remaining && { remaining }),
				...(total && { total }),
				...(refresh && { refresh }),
			},
		}));
	},
	subtractOneCredit() {
		set((state) => ({
			imageCredits: {
				...state.imageCredits,
				remaining: state.imageCredits.remaining - 1,
				// set to 24 hours from now (in ms)
				refresh: new Date(Date.now() + 24 * 60 * 60 * 1000).getTime(),
			},
		}));
	},
	resetImageCredits() {
		set({ imageCredits: startingState.imageCredits });
	},
});
const withDevtools = devtools(store, { name: 'Extendify Draft Globals' });
const withPersist = persist(withDevtools, {
	name: 'extendify_draft_settings',
	storage: createJSONStorage(() => storage),
	skipHydration: true,
});
export const useGlobalStore = create(withPersist);
