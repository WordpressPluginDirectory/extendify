import apiFetch from '@wordpress/api-fetch';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { safeParseJson } from '@launch/lib/parsing';

const initialState = {
	siteType: {},
	siteInformation: {
		title: undefined,
	},
	businessInformation: {
		description: undefined,
		tones: [],
		acceptTerms: false,
	},
	siteTypeSearch: [],
	style: null,
	pages: undefined,
	plugins: undefined,
	goals: undefined,
};

const key = `extendify-launch-user-selection-${window.extSharedData.siteId}`;
const incoming = safeParseJson(window.extSharedData.userData.userSelectionData);
const state = (set, get) => ({
	...initialState,
	// initialize the state with default values
	...(incoming?.state ?? {}),
	...(JSON.parse(localStorage.getItem(key) || '{}')?.state ?? {}), // For testing
	setSiteType(siteType) {
		// Reset the user's selections when site type changes
		set({ ...initialState, siteType });
	},
	setSiteTypeSearch(search) {
		set((state) => ({
			// only keep last 10 searches
			siteTypeSearch: [...state.siteTypeSearch, search].slice(-10),
		}));
	},
	setSiteInformation(name, value) {
		const siteInformation = { ...get().siteInformation, [name]: value };
		set({ siteInformation });
	},
	setBusinessInformation(name, value) {
		const businessInformation = { ...get().businessInformation, [name]: value };
		set({ businessInformation });
	},
	has(type, item) {
		if (!item?.id) return false;
		return (get()?.[type] ?? [])?.some((t) => t.id === item.id);
	},
	add(type, item) {
		if (get().has(type, item)) return;
		set({ [type]: [...(get()?.[type] ?? []), item] });
	},
	addMany(type, items, options = {}) {
		if (options.clearExisting) {
			set({ [type]: items });
			return;
		}
		set({ [type]: [...(get()?.[type] ?? []), ...items] });
	},
	remove(type, item) {
		set({ [type]: get()?.[type]?.filter((t) => t.id !== item.id) });
	},
	removeMany(type, items) {
		set({
			[type]: get()?.[type]?.filter((t) => !items.some((i) => i.id === t.id)),
		});
	},
	toggle(type, item) {
		if (get().has(type, item)) {
			get().remove(type, item);
			return;
		}
		get().add(type, item);
	},
	setStyle(style) {
		set({ style });
	},
	canLaunch() {
		// The user can launch if they have a complete selection
		return (
			Object.keys(get()?.siteType ?? {})?.length > 0 &&
			Object.keys(get()?.style ?? {})?.length > 0
		);
	},
	resetState() {
		set(initialState);
	},
});

const path = '/extendify/v1/shared/user-selections-data';
const storage = {
	getItem: async () => await apiFetch({ path }),
	setItem: async (_name, state) =>
		await apiFetch({ path, method: 'POST', data: { state } }),
};

export const useUserSelectionStore = create(
	persist(devtools(state, { name: 'Extendify User Selections' }), {
		storage: createJSONStorage(() => storage),
		skipHydration: true,
	}),
	state,
);
