import { isEmbedded } from '@shared/lib/embedded-guard';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { track } from '../lib/insights';

const HTML_CLASS = 'extendify-quick-edit-on';

const DEFAULT_ON = !!window.extQuickEditData?.defaultOn;

export const useEditModeStore = create()(
	persist(
		(set, get) => ({
			on: DEFAULT_ON,
			setOn: (on) => {
				const next = !!on;
				if (get().on === next) return;
				set({ on: next });
			},
			toggle: () => set({ on: !get().on }),
		}),
		{
			name: 'extendify-quick-edit-mode',
			partialize: ({ on }) => ({ on }),
		},
	),
);

// This chunk also ships in the Agent bundle, so guarding the class here keeps
// the page from ever looking edit-on inside another tool's iframe (Customizer
// preview, page-builder previews) regardless of which bundle loaded it.
const applyHtmlClass = (on) =>
	document.documentElement.classList.toggle(HTML_CLASS, on && !isEmbedded());

useEditModeStore.subscribe((state) => {
	applyHtmlClass(state.on);
	track(state.on ? 'edit_mode_on' : 'edit_mode_off');
});
applyHtmlClass(useEditModeStore.getState().on);
