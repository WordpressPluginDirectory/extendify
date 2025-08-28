import apiFetch from '@wordpress/api-fetch';
import { safeParseJson } from '@shared/lib/parsing';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

const initialState = {
	siteType: {
		slug: '0default',
		name: 'Default',
	},
	siteStructure: undefined,
	siteProfile: undefined,
	siteStrings: undefined,
	siteImages: undefined,
	siteInformation: {
		title: window.extSharedData.siteTitle || '',
	},
	businessInformation: {
		description: undefined,
		tones: [],
		acceptTerms: false,
	},
	siteObjective: undefined,
	CTALink: undefined,
	siteQA: {
		showHidden: false,
		questions: [],
	},
	attempt: 1,
	sitePlugins: [],
	urlParameters: {
		title: null,
		description: null,
		objective: null,
		structure: null,
	},
};

const incoming = safeParseJson(window.extSharedData.userData.userSelectionData);
const state = (set, get) => ({
	...initialState,
	// initialize the state with default values
	...(incoming?.state ?? {}),
	setSiteStructure: (siteStructure) => set({ siteStructure }),
	setSiteInformation: (name, value) => {
		const siteInformation = { ...get().siteInformation, [name]: value };
		set({ siteInformation });
	},
	setBusinessInformation: (name, value) => {
		const businessInformation = { ...get().businessInformation, [name]: value };
		set({ businessInformation });
	},
	setSiteProfile: (data) => {
		set({
			siteProfile: undefined,
			siteStrings: undefined,
			siteImages: undefined,
		});
		if (!data) data = {};
		const siteProfile = Object.assign(
			{
				aiSiteType: null,
				aiSiteCategory: null,
				aiDescription: null,
				aiKeywords: [],
			},
			data,
		);
		set({ siteProfile });
	},
	setSiteStrings: (data) => {
		if (!data) data = {};
		const siteStrings = Object.assign(
			{ aiHeaders: [], aiBlogTitles: [] },
			data,
		);
		set({ siteStrings });
	},
	setSiteImages: (data) => {
		if (!data) data = {};
		const siteImages = Object.assign({ siteImages: [] }, data);
		set({ siteImages });
	},
	setSiteObjective: (siteObjective) =>
		set((state) =>
			state.siteObjective !== siteObjective ? { siteObjective } : state,
		),
	setCTALink: (CTALink) => set({ CTALink }),
	has: (type, item) => {
		if (!item?.id) return false;
		return (get()?.[type] ?? [])?.some((t) => t.id === item.id);
	},
	add: (type, item) => {
		if (get().has(type, item)) return;
		set({ [type]: [...(get()?.[type] ?? []), item] });
	},
	addMany: (type, items, options = {}) => {
		if (options.clearExisting) {
			set({ [type]: items });
			return;
		}
		set({ [type]: [...(get()?.[type] ?? []), ...items] });
	},
	remove: (type, item) =>
		set({ [type]: get()?.[type]?.filter((t) => t.id !== item.id) }),
	removeMany: (type, items) => {
		set({
			[type]: get()?.[type]?.filter((t) => !items.some((i) => i.id === t.id)),
		});
	},
	removeAll: (type) => set({ [type]: [] }),
	toggle: (type, item) => {
		if (get().has(type, item)) {
			get().remove(type, item);
			return;
		}
		get().add(type, item);
	},
	resetState: () =>
		set((state) => ({ ...initialState, attempt: state?.attempt + 1 })),
	setVariation: (variation) => set({ variation }),
	setSiteQuestions: (questions) => set({ siteQA: questions }),
	setSiteQuestionAnswer: (
		questionId,
		answer,
		{ isExtraField = false, extraFieldKey = null } = {},
	) => {
		set((state) => {
			const { siteQA } = state;

			const questions = siteQA?.questions.map((q) => {
				if (q.id !== questionId) return q;

				if (!isExtraField) {
					return { ...q, answerUser: answer };
				}

				// isExtraField === true
				const updatedExtraFields = q.extraFields?.map((ef) =>
					ef.key === extraFieldKey ? { ...ef, answer } : ef,
				);

				return { ...q, extraFields: updatedExtraFields };
			});

			return {
				siteQA: {
					...siteQA,
					questions,
				},
			};
		});
	},
	setShowHiddenQuestions: (showHidden) =>
		set({ siteQA: { ...get().siteQA, showHidden } }),
	setUrlParameters: (params) =>
		set((state) => {
			if (!params || Object.keys(params).length === 0) return state;
			const prev = state.urlParameters;
			const same = Object.entries(params).every(([k, v]) => v === prev[k]);

			if (same) return state;
			return { urlParameters: { ...prev, ...params } };
		}),
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
