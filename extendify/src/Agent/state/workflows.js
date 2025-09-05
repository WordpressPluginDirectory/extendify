import apiFetch from '@wordpress/api-fetch';
import { deepMerge } from '@shared/lib/utils';
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { workflows } from '@agent/workflows/workflows';

const state = (set, get) => ({
	workflow: null,
	block: null, // data-extendify-agent-block-id value
	setBlock: (block) => set({ block }),
	getWorkflow: () => {
		const curr = get().workflow;
		const currentWorkflow = workflows.find((w) => w.id === curr?.id);
		return deepMerge(curr, currentWorkflow || {});
	},
	// Gets the workflows available to the user
	getAvailableWorkflows: () => {
		let wfs = workflows.filter(({ available }) => available());
		// If a block is set, only include those with 'block'
		const blockWorkflows = wfs.filter(({ requires }) =>
			requires?.includes('block'),
		);
		if (get().block) return blockWorkflows;
		// otherwise remove all of the above
		return wfs.filter(({ id }) => !blockWorkflows.some((w) => w.id === id));
	},
	getWorkflowsByFeature: ({ requires } = {}) => {
		if (!requires) return workflows.filter(({ available }) => available());
		// e.g. requires: ['block']
		return workflows.filter(
			({ available, requires: workflowRequires }) =>
				available() &&
				(!requires || workflowRequires?.some((s) => requires.includes(s))),
		);
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
		partialize: (state) => {
			// eslint-disable-next-line
			const { block, ...rest } = state;
			return { ...rest };
		},
	}),
);
