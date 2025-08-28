import apiFetch from '@wordpress/api-fetch';
import { deepMerge } from '@shared/lib/utils';
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { workflows } from '@agent/workflows/workflows';

const state = (set, get) => ({
	workflow: null,
	getWorkflow: () => {
		const curr = get().workflow;
		const currentWorkflow = workflows.find((w) => w.id === curr?.id);
		return deepMerge(curr, currentWorkflow || {});
	},
	workflowData: null,
	// This is the history of the results
	// { answerId: '', summary: '', canceled: false,  reason: '', error: false, completed: false, whenFinishedTool: null }[]
	workflowHistory: window.extAgentData?.workflowHistory || [],
	// Data for the tool component that shows up at the end of a workflow
	whenFinishedToolProps: null,
	getWhenFinishedToolProps: () => {
		const { whenFinishedToolProps } = get();
		if (!whenFinishedToolProps) return null;
		return {
			...whenFinishedToolProps,
			onConfirm: (props = {}) => {
				window.dispatchEvent(
					new CustomEvent('extendify-agent:workflow-confirm', {
						detail: { ...props, whenFinishedToolProps },
					}),
				);
			},
			onCancel: () => {
				window.dispatchEvent(
					new CustomEvent('extendify-agent:workflow-cancel', {
						detail: { whenFinishedToolProps },
					}),
				);
			},
		};
	},
	addWorkflowResult: async (data) => {
		set((state) => {
			const max = Math.max(0, state.workflowHistory.length - 10);
			return {
				workflowHistory: [data, ...state.workflowHistory.toSpliced(0, max)],
			};
		});
		// Persist it to the server
		const path = '/extendify/v1/agent/workflows';
		await apiFetch({
			method: 'POST',
			path,
			data: { workflowId: get().workflow.id, ...data },
		});
	},
	mergeWorkflowData: (data) => {
		set((state) => {
			if (!state.workflowData) return { workflowData: data };
			return {
				workflowData: { ...state.workflowData, ...data },
			};
		});
	},
	setWorkflow: (workflow) =>
		set({
			workflow: workflow
				? { ...workflow, startingPage: window.location.href }
				: null,
			workflowData: null,
			whenFinishedToolProps: null,
		}),
	setWhenFinishedToolProps: (whenFinishedToolProps) =>
		set({ whenFinishedToolProps }),
});

export const useWorkflowStore = create()(
	persist(devtools(state, { name: 'Extendify Agent Workflows' }), {
		name: `extendify-agent-workflows-${window.extSharedData.siteId}`,
	}),
);
