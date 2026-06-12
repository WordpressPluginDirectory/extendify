import { useChatStore } from '@agent/state/chat';
import { useGlobalStore } from '@agent/state/global';
import { tools } from '@agent/workflows/workflows';
import { AI_HOST } from '@constants';
import { useQuickEditStore } from '@quick-edit/state/store';
import { digest } from '@shared/api/digest';
import { reqDataBasics } from '@shared/lib/data';

const extra = () => {
	const { x, y, width, height } = useGlobalStore.getState();
	return {
		userAgent: window?.navigator?.userAgent,
		vendor: window?.navigator?.vendor || 'unknown',
		platform:
			window?.navigator?.userAgentData?.platform ||
			window?.navigator?.platform ||
			'unknown',
		mobile: window?.navigator?.userAgentData?.mobile,
		width: window.innerWidth,
		height: window.innerHeight,
		screenHeight: window.screen.height,
		screenWidth: window.screen.width,
		orientation: window.screen.orientation?.type,
		touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
		agentUI: { x, y, width, height },
	};
};

export const pickWorkflow = async ({ workflows, options }) => {
	const { failedWorkflows, context } = window.extAgentData;
	const failed = failedWorkflows ?? new Set();
	const filteredWorkflows = workflows.filter((wf) => !failed.has(wf.id));

	const block = useQuickEditStore.getState().agentBlock;

	const messages = useChatStore.getState().getMessagesForAI();
	const lastAssistantMessage = useChatStore
		.getState()
		.getLastAssistantMessage();

	const response = await fetch(`${AI_HOST}/api/agent/find-agent`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		signal: options?.signal,
		body: JSON.stringify({
			...reqDataBasics,
			workflows: filteredWorkflows,
			previousWorkflow: {
				workflowId: lastAssistantMessage?.details?.workflowId,
				language: lastAssistantMessage?.details?.language,
				lastMessage: lastAssistantMessage?.details?.content,
				sessionId: lastAssistantMessage?.details?.sessionId,
			},
			context,
			agentContext: window.extAgentData.agentContext,
			messages: messages.slice(-5),
			hasBlock: Boolean(block), // todo: remove this
			blockDetails: block,
			...options,
			extra: extra(),
		}),
	});

	if (!response.ok) {
		digest({
			error: {
				name: response.statusText,
				messages: response.statusMessage,
			},
			details: { source: 'agent', caller: 'pick-workflow' },
		});
		const error = new Error('Bad response from server');
		error.response = response;
		throw error;
	}
	return await response.json();
};

export const handleWorkflow = async ({ workflow, workflowData, options }) => {
	const messages = useChatStore.getState().getMessagesForAI();
	const response = await fetch(`${AI_HOST}/api/agent/handle-workflow`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		signal: options?.signal,
		body: JSON.stringify({
			...reqDataBasics,
			workflow,
			workflowData,
			messages: messages,
			context: window.extAgentData.context,
			agentContext: window.extAgentData.agentContext,
			retry: options?.retry || false,
			extra: extra(),
		}),
	});

	if (!response.ok) throw new Error('Bad response from server');
	return await response.json();
};

export const rateAnswer = ({ answerId, rating }) =>
	fetch(`${AI_HOST}/api/agent/rate-workflow`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ answerId, rating }),
	}).catch((error) =>
		digest({
			error: error,
			details: { source: 'agent', caller: 'rateAnswer', answerId, rating },
		}),
	);

export const callTool = async ({ tool, inputs }) => {
	if (!tools[tool]) throw new Error(`Tool ${tool} not found`);
	return await tools[tool](inputs);
};

export const recordAgentActivity = ({ action, sessionId, value = {} }) => {
	return fetch(`${AI_HOST}/api/agent/activities`, {
		keepalive: true,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...reqDataBasics,
			action,
			sessionId,
			value,
		}),
	});
};
