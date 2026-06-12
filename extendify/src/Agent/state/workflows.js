import { isChangeSiteDesignWorkflowAvailable } from '@agent/lib/util';
import changeSiteDesignWorkflow from '@agent/workflows/theme/change-site-design';
import variationsWorkflow from '@agent/workflows/theme/change-theme-variation';
import { workflows } from '@agent/workflows/workflows';
import { useQuickEditStore } from '@quick-edit/state/store';
import { deepMerge } from '@shared/lib/utils';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const onboarding = window.extAgentData.chatHistory?.length === 0;
const agentResponse = isChangeSiteDesignWorkflowAvailable()
	? changeSiteDesignWorkflow.example?.agentResponse
	: variationsWorkflow.example?.agentResponse;
const onboardingToolProps = {
	...agentResponse.whenFinishedTool,
	agentResponse,
};

// Used to check case-insensitive matches for workflow examples
const collator = new Intl.Collator(undefined, {
	sensitivity: 'base',
	usage: 'search',
});

const state = (set, get) => ({
	workflow: null,
	// Data for the tool component that shows up at the end of a workflow
	whenFinishedToolProps: null,
	getWorkflow: () => {
		const curr = get().workflow;
		// Workflows may define a "parent" workflow via templateId
		const currId = curr?.templateId || curr?.id;
		const wf = workflows.find(({ id }) => id === currId);
		if (!wf?.id) return curr || null;
		return { ...deepMerge(curr, wf || {}), id: curr?.id };
	},
	getWorkflowByExample: (example) => {
		const wf = workflows.find(
			({ example: ex }) => collator.compare(ex?.text, example) === 0,
		);
		if (!wf?.id) return null;
		return wf;
	},
	// Gets the workflows available to the user
	// TODO: maybe we need to have a way to include a
	// workflow regardless of the block being active?
	getAvailableWorkflows: () => {
		const wfs = workflows.filter(({ available }) => available());
		// If a block is set, only include those with 'block'
		const blockWorkflows = wfs.filter(({ requires }) =>
			requires?.includes('block'),
		);
		if (useQuickEditStore.getState().agentBlock) return blockWorkflows;
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
	mergeWorkflowData: (data) => {
		set((state) => {
			if (!state.workflowData) return { workflowData: data };
			return {
				workflowData: { ...state.workflowData, ...data },
			};
		});
	},
	setWorkflow: (workflow) => {
		const agentBlockCode = useQuickEditStore.getState().agentBlockCode;
		set({
			workflow: workflow
				? { ...workflow, startingPage: window.location.href }
				: null,
			// If a block is selected, add it to the workflow data
			// previousContent is named this way for legacy reasons
			workflowData: agentBlockCode ? { previousContent: agentBlockCode } : null,
			whenFinishedToolProps: null,
		});
	},
	setWhenFinishedToolProps: (whenFinishedToolProps) =>
		set({ whenFinishedToolProps }),
});

export const useWorkflowStore = create()(
	persist(devtools(state, { name: 'Extendify Agent Workflows' }), {
		name: `extendify-agent-workflows-${window.extSharedData.siteId}`,
		merge: (persistedState, currentState) => {
			// if we are in onboarding mode, add the starting workflow
			if (onboarding) {
				return {
					...currentState,
					...persistedState,
					workflow: isChangeSiteDesignWorkflowAvailable()
						? changeSiteDesignWorkflow
						: variationsWorkflow,
					whenFinishedToolProps: onboardingToolProps,
				};
			}
			return { ...currentState, ...persistedState };
		},
	}),
);
