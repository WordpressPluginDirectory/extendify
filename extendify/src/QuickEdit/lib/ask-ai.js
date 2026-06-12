import { useQuickEditStore } from '../state/store';
import { buildAgentBlockDescriptor } from './agent-block-descriptor';

const AGENT_ATTR = 'data-extendify-agent-block-id';
const AGENT_PART_ID = 'data-extendify-part-block-id';

export const isAgentAvailable = () => !!window.extAgentData;

export const hasAgentBlockSelected = () => {
	if (!isAgentAvailable()) return false;
	return !!useQuickEditStore.getState().agentBlock;
};

// listener(hasBlock: boolean). Returns an unsubscribe fn.
export const subscribeToAgentBlock = (listener) => {
	if (!isAgentAvailable()) return () => {};
	let prev = !!useQuickEditStore.getState().agentBlock;
	return useQuickEditStore.subscribe((state) => {
		const next = !!state.agentBlock;
		if (next !== prev) {
			prev = next;
			listener(next);
		}
	});
};

// Synchronous-readable cache of the agent sidebar's open state. The click
// rule runs in a sync capture-phase listener and can't await a dynamic
// import to choose between today's commit and the silent-stage bridge.
// Watcher is kicked off lazily on first read so a Jest resetModules + doMock
// can swap the agent store before the import resolves.
let cachedSidebarOpen = false;
let watcherStarted = false;
const startSidebarWatcher = () => {
	if (watcherStarted || !isAgentAvailable()) return;
	watcherStarted = true;
	import('@agent/state/global').then(({ useGlobalStore }) => {
		cachedSidebarOpen = !!useGlobalStore.getState().open;
		useGlobalStore.subscribe((state) => {
			cachedSidebarOpen = !!state.open;
		});
	});
};

export const isAgentSidebarOpen = () => {
	startSidebarWatcher();
	return cachedSidebarOpen;
};

const findAgentTagged = (el) => {
	let node = el;
	while (node && node !== document.body) {
		if (node.hasAttribute?.(AGENT_ATTR) || node.hasAttribute?.(AGENT_PART_ID)) {
			return node;
		}
		node = node.parentElement;
	}
	return null;
};

// Bridges the gap between the click and the Agent's own selection
// outline (which renders after panel mount + ResizeObserver settles).
const flashSelection = (el) => {
	if (!el) return;
	el.classList.add('extendify-quick-edit-ask-flash');
	window.setTimeout(() => {
		el.classList.remove('extendify-quick-edit-ask-flash');
	}, 1500);
};

// Focus the agent chat textarea so the user can type their request right
// away. The textarea is created when the panel mounts; the brief retry
// covers the open-from-closed case where it isn't in the DOM yet (when the
// sidebar is already open it's found on the first try). preventScroll keeps
// the block the user just clicked in view rather than yanking to the chat.
const focusChatInput = (tries = 20) => {
	const ta = document.querySelector('#extendify-agent-chat-textarea');
	if (ta) {
		ta.focus({ preventScroll: true });
		return;
	}
	if (tries > 0) setTimeout(() => focusChatInput(tries - 1), 50);
};

// Stage a block for the already-open agent. No setOpen — the sidebar is
// already up — but we DO focus the chat so the cursor lands ready to type,
// matching the Ask AI pill and the selector behavior on a fresh open. The
// visual bridge is the same flash + the agent's DOMHighlighter outline that
// engages once agentBlock is set.
export const stageAgentBlock = (el) => {
	if (!isAgentAvailable()) return;
	const match = findAgentTagged(el);
	if (!match) return;
	flashSelection(match);
	const next = buildAgentBlockDescriptor(match);
	const current = useQuickEditStore.getState().agentBlock;
	if (!current || current.id !== next.id || current.target !== next.target) {
		useQuickEditStore.setState({
			agentBlock: next,
			agentBlockCode: null,
		});
	}
	focusChatInput();
};

export const askAiAboutElement = async (el) => {
	if (!isAgentAvailable()) return;

	const match = findAgentTagged(el);
	flashSelection(match || el);

	// setBlock before setOpen so DOMHighlighter sees the block on mount.
	const { useGlobalStore } = await import('@agent/state/global');
	const { useEditModeStore } = await import('@quick-edit/state/edit-mode');

	if (match) {
		// Edit mode is the gate that mounts DOMHighlighter — turn it on so
		// the X-close indicator renders alongside the selection. Skip
		// re-setting agentBlock when the user is re-clicking Ask AI on
		// the already-staged block: pushing a new descriptor would churn
		// DOMHighlighter and any workflow that pinned the block.
		useEditModeStore.getState().setOn(true);
		const next = buildAgentBlockDescriptor(match);
		const current = useQuickEditStore.getState().agentBlock;
		if (!current || current.id !== next.id || current.target !== next.target) {
			useQuickEditStore.setState({
				agentBlock: next,
				agentBlockCode: null,
			});
		}
	}
	useGlobalStore.getState().setOpen(true);

	focusChatInput();
};
