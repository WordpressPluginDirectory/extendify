import {
	getHomeShape,
	getImagesShape,
	getLogoShape,
	getPagesShape,
	getPluginsShape,
	getProfileShape,
	getStringsShape,
	getStyleShape,
} from '@auto-launch/fetchers/shape';
import { __ } from '@wordpress/i18n';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { overrideWithUrlParams, urlParams, urlParamsShape } from './url-params';

const shapeToKeyValue = (shape) => {
	return Object.fromEntries(
		Object.keys(shape.shape).map((key) => [key, undefined]),
	);
};

const initialState = {
	// translators: this is for a action log UI. Keep it short
	statusMessages: [__('Booting things up', 'extendify-local')],
	errorMessage: null,
	errorCount: 0,
	description: null,
	descriptionBackup: undefined,
	descriptionRaw: null,
	urlParams: {},
	siteProfile: {
		...shapeToKeyValue(getProfileShape),
	},
	...shapeToKeyValue(getLogoShape),
	...shapeToKeyValue(getPluginsShape),
	...shapeToKeyValue(getStyleShape),
	...shapeToKeyValue(getStringsShape),
	...shapeToKeyValue(getImagesShape),
	...shapeToKeyValue(getHomeShape),
	...shapeToKeyValue(getPagesShape),
};

const state = (set, get) => ({
	...initialState,
	urlParams: {
		...initialState.urlParams,
		...urlParams,
	},
	title: urlParams.title || undefined,
	description: urlParams.description || undefined,
	descriptionBackup: urlParams.description || undefined,
	descriptionRaw: urlParams.description || undefined,
	pulse: false,
	setPulse: (value) => set({ pulse: value }),
	setData: (key, value) => {
		if (!isValidKey(key)) return;
		if (get()[key] === value) return; // avoid unnecessary updates
		set({ [key]: value });
	},
	addStatusMessage: (message) => {
		const currentMessages = get().statusMessages;
		// remove any previous duplicates
		const prev = currentMessages.filter((msg) => msg !== message);
		set({ statusMessages: [...prev, message] });
	},
	setErrorMessage: (message) => {
		set((state) => ({
			errorMessage: message,
			errorCount: state.errorCount + 1,
		}));
	},
	needToStall: () => get().errorCount > 6,
	resetErrorCount: () => {
		set({ errorCount: 0 });
	},
	reset: ({ exclude }) => {
		const newState = { ...initialState };
		if (exclude && Array.isArray(exclude)) {
			exclude.forEach((key) => {
				if (!isValidKey(key)) return;
				newState[key] = get()[key];
			});
		}
		set(newState);
	},
});

// Checks that a key being set is actually something we expect
const isValidKey = (key) => Object.keys(initialState).includes(key);

const keySchemas = {
	urlParams: urlParamsShape,
	siteProfile: getProfileShape,
	...Object.fromEntries(
		[
			getLogoShape,
			getPluginsShape,
			getStyleShape,
			getStringsShape,
			getImagesShape,
			getHomeShape,
			getPagesShape,
		].flatMap((s) => Object.entries(s.shape)),
	),
};

export const useLaunchDataStore = create(
	persist(devtools(state, { name: 'Extendify Launch Data' }), {
		name: `extendify-launch-data-${window.extSharedData.siteId}`,
		merge: (persisted, current) => {
			if (!persisted || typeof persisted !== 'object') return current;

			// Make sure the persisted state is valid and not corrupted.
			// This gives us some recovery on page reload
			const validated = Object.fromEntries(
				Object.entries(persisted)
					.filter(([key]) => key in keySchemas)
					.map(([key, value]) => {
						const result = keySchemas[key].safeParse(value);
						return [key, result.success ? result.data : undefined];
					}),
			);

			// Merge in the url params
			const { title, description, ...urlParamsMapped } =
				overrideWithUrlParams(urlParams);

			return {
				...current,
				...persisted,
				...validated,
				// If there's a URL param here it should override these values
				title: title || current.title,
				description: description || current.description,
				descriptionRaw: description || current.descriptionRaw,
				urlParams: {
					...current.urlParams,
					...persisted.urlParams,
					...validated.urlParams,
					...urlParamsMapped,
				},
			};
		},
		partialize: (state) => {
			const {
				statusMessages,
				errorMessage,
				errorCount,
				pulse,
				description,
				descriptionRaw,
				title,
				...rest
			} = state;
			return Object.fromEntries(
				Object.entries(rest).filter(([, v]) =>
					Array.isArray(v) ? v.length > 0 : Boolean(v),
				),
			);
		},
	}),
	state,
);
