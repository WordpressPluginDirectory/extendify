import { usePositionStore } from '@agent/state/position';
import { isInTheFuture } from '@wordpress/date';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useGlobalStore = create()(
	persist(
		devtools(
			(set, get) => ({
				retryAfter: undefined,
				open: true,
				minimized: false,
				showSuggestions: true,
				// e.g. floating, docked-left, docked-right ?
				mode: window.extAgentData.agentPosition,
				queuedTour: null,
				scratch: {},
				isMobile: window.innerWidth < 768,
				setIsMobile: (isMobile) => {
					if (get().isMobile === isMobile) return;
					set({ isMobile });
				},
				queueTourForRedirect: (tour) => set({ queuedTour: tour }),
				clearQueuedTour: () => set({ queuedTour: null }),
				setOpen: (open) => {
					if (!open) {
						usePositionStore.getState().resetPosition();
						window.dispatchEvent(
							new CustomEvent('extendify-agent:cancel-workflow'),
						);
					}
					set({ open });
				},
				setMinimized: (minimized) => {
					if (get().minimized === minimized) return;
					set({ minimized });
				},
				setShowSuggestions: (show) => set({ showSuggestions: show }),
				toggleOpen: () =>
					set((state) => {
						if (!state.open) {
							usePositionStore.getState().resetPosition();
						}
						return { open: !state.open };
					}),
				updateRetryAfter: (retryAfter) => set({ retryAfter }),
				isChatAvailable: () => {
					const { retryAfter } = get();
					if (!retryAfter) return true;
					const stillWaiting = isInTheFuture(new Date(Number(retryAfter)));
					if (!stillWaiting) set({ retryAfter: undefined });
					return !stillWaiting;
				},
				setScratch: (key, value) =>
					set((state) => ({ scratch: { ...state.scratch, [key]: value } })),
				getScratch: (key) => get().scratch[key] || null,
				deleteScratch: (key) =>
					set((state) => {
						const { [key]: _, ...rest } = state.scratch;
						return { scratch: rest };
					}),
			}),
			{ name: 'Extendify Agent Global' },
		),
		{
			name: `extendify-agent-global-${window.extSharedData.siteId}`,
			merge: (persistedState, currentState) => {
				// force open if we hit the success page
				const open = window.extAgentData?.startOnboarding
					? true
					: (persistedState?.open ?? currentState.open);
				return { ...currentState, ...persistedState, open };
			},
			partialize: (state) => {
				// mode is determined on the server
				const { showSuggestions, isMobile, mode, ...rest } = state;
				return { ...rest };
			},
		},
	),
);
