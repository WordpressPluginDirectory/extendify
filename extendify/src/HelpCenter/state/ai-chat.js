import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

const state = (set, get) => ({
	history: [],
	experienceLevel: 'beginner',
	currentQuestion: undefined,
	setCurrentQuestion(currentQuestion) {
		set({ currentQuestion });
	},
	setExperienceLevel(experienceLevel) {
		set({ experienceLevel });
	},
	addHistory(question) {
		set((state) => ({
			// Save the latest 10
			history: [
				question,
				...state.history
					.filter(({ answerId }) => answerId !== question.answerId)
					.slice(0, 9),
			],
		}));
	},
	hasHistory() {
		return get().history.length > 0;
	},
	clearHistory() {
		set({ history: [] });
	},
	deleteFromHistory(question) {
		set((state) => ({
			history: state.history.filter(
				({ answerId: id }) => id !== question.answerId,
			),
		}));
	},
	historyCount() {
		return get().history.length;
	},
});

export const useAIChatStore = create(
	persist(devtools(state, { name: 'Extendify Chat History' }), {
		name: 'extendify-chat-history',
		storage: createJSONStorage(() => localStorage),
		partialize: (state) => {
			return {
				history: state.history,
				experienceLevel: state.experienceLevel,
			};
		},
	}),
	state,
);
