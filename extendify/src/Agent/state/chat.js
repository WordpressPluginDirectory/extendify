import { isChangeSiteDesignWorkflowAvailable, makeId } from '@agent/lib/util';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

const { chatHistory } = window.extAgentData;

const welcomeMessage = [
	{
		id: 1,
		type: 'message',
		details: {
			role: 'assistant',
			// translators: this is the initial message in the agent chat, welcoming the user. Keep it short and friendly and follow the same markdown format and emoji.
			content: isChangeSiteDesignWorkflowAvailable()
				? __(
						'#### Your site is ready 🎉\nWant to explore other website designs?',
						'extendify-local',
					)
				: __(
						'#### Your site is ready 🎉\nWant to explore other site colors?',
						'extendify-local',
					),
		},
	},
];
const state = (set, get) => ({
	messages: chatHistory?.length ? chatHistory.toReversed() : welcomeMessage,
	// Messages sent to the api, user and assistant only. Up until the last workflow
	getMessagesForAI: () => {
		const messages = [];
		let foundUserMessage = false;
		for (const { type, details } of get().messages.toReversed()) {
			const finished =
				['completed', 'canceled'].includes(details.status) ||
				(['status'].includes(type) && details.type === 'workflow-canceled');
			if (type === 'workflow' && finished) break;
			if (type === 'workflow-component' && finished) break;
			// This prevents a loop of assistant messages from being at the end
			if (type === 'message' && details.role === 'user') {
				foundUserMessage = true;
			}
			if (type === 'message' && !foundUserMessage) continue;
			if (type === 'message') messages.push(details);
		}
		return messages.toReversed();
	},
	getLastAssistantMessage: () =>
		get()?.messages?.findLast(
			(message) =>
				message.type === 'message' && message.details?.role === 'assistant',
		),
	hasMessages: () => get().messages.length > 0,
	addMessage: (type, details) => {
		const id = makeId();
		set((state) => {
			// max 150 messages
			const max = Math.max(0, state.messages.length - 149);
			const next = { id, type, details };
			return {
				// { id: 1, type: message, details: { role: 'user', content: 'Hello' } }
				// { id: 2, type: message, details: { role: 'assistant', content: 'Hi there!' } }
				// { id: 3, type: workflow, details: { name: 'Workflow 1' } }
				// { id: 5, type: status, details: { type: 'calling-agent' }
				messages: [...state.messages.toSpliced(0, max), next],
			};
		});
		return id;
	},
	// pop messages all the way back to the last agent message
	popMessage: () => {
		set((state) => ({
			messages: state.messages?.slice(0, -1) || [],
		}));
	},
	clearMessages: () => set({ messages: [] }),
});

const path = '/extendify/v1/agent/chat-events';
const storage = {
	getItem: async () => await apiFetch({ path }),
	setItem: async (_name, state) =>
		await apiFetch({ path, method: 'POST', data: { state } }),
};

export const useChatStore = create()(
	persist(devtools(state, { name: 'Extendify Agent Chat' }), {
		name: `extendify-agent-chat-${window.extSharedData.siteId}`,
		storage: createJSONStorage(() => storage),
		skipHydration: true,
	}),
);
