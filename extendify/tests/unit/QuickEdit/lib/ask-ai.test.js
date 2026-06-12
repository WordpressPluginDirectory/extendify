// Pins three contracts: the isAgentAvailable() truth table against the
// window.extAgentData global, the subscribeToAgentBlock listener semantics
// (no-op when agent unavailable, fires only on hasBlock transitions), and
// the askAiAboutElement orchestration (setBlock-before-setOpen, X-close
// indicator visible, chat textarea focus retry).

const mockQuickEditState = { agentBlock: null };
const mockQuickEditListeners = new Set();
const mockQuickEditSetState = jest.fn((patch) => {
	const prev = { ...mockQuickEditState };
	Object.assign(mockQuickEditState, patch);
	for (const fn of mockQuickEditListeners) fn({ ...mockQuickEditState }, prev);
});

jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: {
		getState: () => ({
			agentBlock: mockQuickEditState.agentBlock,
		}),
		setState: mockQuickEditSetState,
		subscribe: (fn) => {
			mockQuickEditListeners.add(fn);
			return () => mockQuickEditListeners.delete(fn);
		},
	},
}));

const mockGlobalState = { open: false };
const mockGlobalListeners = new Set();
const mockSetOpen = jest.fn((open) => {
	mockGlobalState.open = open;
	for (const fn of mockGlobalListeners) fn({ ...mockGlobalState });
});
jest.mock('@agent/state/global', () => ({
	useGlobalStore: {
		getState: () => ({ open: mockGlobalState.open, setOpen: mockSetOpen }),
		subscribe: (fn) => {
			mockGlobalListeners.add(fn);
			return () => mockGlobalListeners.delete(fn);
		},
	},
}));

const mockSetOn = jest.fn();
jest.mock('@quick-edit/state/edit-mode', () => ({
	useEditModeStore: {
		getState: () => ({ setOn: mockSetOn }),
	},
}));

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	mockQuickEditState.agentBlock = null;
	mockQuickEditListeners.clear();
	mockGlobalState.open = false;
	mockGlobalListeners.clear();
	delete window.extAgentData;
	document.body.innerHTML = '';
});

describe('isAgentAvailable — truth table on window.extAgentData', () => {
	const cases = [
		['undefined', undefined, false],
		['null', null, false],
		['empty object', {}, true],
		['object with no keys', Object.create(null), true],
		['object with keys', { partnerId: 'p1' }, true],
	];

	for (const [name, value, expected] of cases) {
		it(`returns ${expected} when extAgentData is ${name}`, async () => {
			if (value === undefined) {
				delete window.extAgentData;
			} else {
				window.extAgentData = value;
			}
			const { isAgentAvailable } = await import('@quick-edit/lib/ask-ai');
			expect(isAgentAvailable()).toBe(expected);
		});
	}
});

describe('hasAgentBlockSelected', () => {
	it('returns false when agent is not available even if a block is set', async () => {
		mockQuickEditState.agentBlock = { id: 'b-1' };
		const { hasAgentBlockSelected } = await import('@quick-edit/lib/ask-ai');
		expect(hasAgentBlockSelected()).toBe(false);
	});

	it('returns false when agent is available but no block is set', async () => {
		window.extAgentData = {};
		const { hasAgentBlockSelected } = await import('@quick-edit/lib/ask-ai');
		expect(hasAgentBlockSelected()).toBe(false);
	});

	it('returns true when agent is available and a block is set', async () => {
		window.extAgentData = {};
		mockQuickEditState.agentBlock = { id: 'b-1' };
		const { hasAgentBlockSelected } = await import('@quick-edit/lib/ask-ai');
		expect(hasAgentBlockSelected()).toBe(true);
	});
});

describe('subscribeToAgentBlock', () => {
	it('returns a no-op unsubscribe when agent is unavailable and never fires the listener', async () => {
		const { subscribeToAgentBlock } = await import('@quick-edit/lib/ask-ai');
		const listener = jest.fn();
		const unsubscribe = subscribeToAgentBlock(listener);
		expect(typeof unsubscribe).toBe('function');
		expect(() => unsubscribe()).not.toThrow();
		// Fire a store change anyway — it must NOT reach the listener because
		// the no-agent path never subscribes.
		mockQuickEditSetState({ agentBlock: { id: 'b-1' } });
		expect(listener).not.toHaveBeenCalled();
	});

	it('fires the listener only on hasBlock transitions', async () => {
		window.extAgentData = {};
		const { subscribeToAgentBlock } = await import('@quick-edit/lib/ask-ai');
		const listener = jest.fn();
		subscribeToAgentBlock(listener);

		mockQuickEditSetState({ agentBlock: { id: 'b-1' } });
		expect(listener).toHaveBeenCalledWith(true);
		expect(listener).toHaveBeenCalledTimes(1);

		mockQuickEditSetState({ agentBlock: { id: 'b-2' } });
		expect(listener).toHaveBeenCalledTimes(1);

		mockQuickEditSetState({ agentBlock: null });
		expect(listener).toHaveBeenCalledWith(false);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('unsubscribes via the returned fn', async () => {
		window.extAgentData = {};
		const { subscribeToAgentBlock } = await import('@quick-edit/lib/ask-ai');
		const listener = jest.fn();
		const unsubscribe = subscribeToAgentBlock(listener);
		unsubscribe();
		mockQuickEditSetState({ agentBlock: { id: 'b-1' } });
		expect(listener).not.toHaveBeenCalled();
	});
});

describe('askAiAboutElement — no-op when agent unavailable', () => {
	it('does not write the store or open the sidebar', async () => {
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		await askAiAboutElement(document.createElement('p'));
		expect(mockQuickEditSetState).not.toHaveBeenCalled();
		expect(mockSetOpen).not.toHaveBeenCalled();
	});
});

describe('askAiAboutElement — agent available', () => {
	beforeEach(() => {
		window.extAgentData = {};
	});

	it('flashes the element when no tagged ancestor is found, but still opens the sidebar', async () => {
		jest.useFakeTimers();
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const el = document.createElement('p');
		document.body.appendChild(el);

		await askAiAboutElement(el);

		expect(el.classList.contains('extendify-quick-edit-ask-flash')).toBe(true);
		expect(mockQuickEditSetState).not.toHaveBeenCalled();
		expect(mockSetOpen).toHaveBeenCalledWith(true);

		jest.advanceTimersByTime(1500);
		expect(el.classList.contains('extendify-quick-edit-ask-flash')).toBe(false);
		jest.useRealTimers();
	});

	it('sets the agent block + opens the sidebar when a tagged ancestor is found', async () => {
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.classList.add('wp-block-paragraph');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		wrapper.textContent = 'hello';
		document.body.appendChild(wrapper);

		await askAiAboutElement(wrapper);

		expect(mockSetOn).toHaveBeenCalledWith(true);
		expect(mockQuickEditSetState).toHaveBeenCalledTimes(1);
		const [patch] = mockQuickEditSetState.mock.calls[0];
		expect(patch.agentBlockCode).toBeNull();
		expect(patch.agentBlock).toMatchObject({
			id: 'b-1',
			target: 'data-extendify-agent-block-id',
			hasNav: false,
			hasSiteTitle: false,
			hasSiteLogo: false,
			hasLinks: false,
			hasImages: false,
			hasText: true,
		});
		expect(mockSetOpen).toHaveBeenCalledWith(true);
	});

	it('promotes the template-part ancestor when present (id + target + template)', async () => {
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const part = document.createElement('header');
		part.setAttribute('data-extendify-part', 'header');
		part.setAttribute('data-extendify-part-block-id', 'part-7');

		const inner = document.createElement('div');
		inner.setAttribute('data-extendify-agent-block-id', 'b-1');
		inner.textContent = 'logo+nav';
		part.appendChild(inner);
		document.body.appendChild(part);

		await askAiAboutElement(inner);

		const [patch] = mockQuickEditSetState.mock.calls[0];
		expect(patch.agentBlock).toMatchObject({
			id: 'part-7',
			target: 'data-extendify-part-block-id',
			template: 'header',
		});
	});

	it('focuses the agent chat textarea once it mounts', async () => {
		jest.useFakeTimers();
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(wrapper);

		const focusPromise = askAiAboutElement(wrapper);
		await focusPromise;

		const textarea = document.createElement('textarea');
		textarea.id = 'extendify-agent-chat-textarea';
		const focusSpy = jest.spyOn(textarea, 'focus');
		document.body.appendChild(textarea);

		// First tryFocus() ran inline (no textarea yet); retries are setTimeout-based.
		jest.advanceTimersByTime(50);
		expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
		jest.useRealTimers();
	});

	it('detects hasNav / hasSiteTitle / hasSiteLogo / hasImages / hasLinks on the matched element', async () => {
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('header');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		wrapper.innerHTML = `
			<h1 class="wp-block-site-title">Site</h1>
			<div class="wp-block-site-logo"><img src="x" /></div>
			<nav class="wp-block-navigation"><a href="/">Home</a></nav>
		`;
		document.body.appendChild(wrapper);

		await askAiAboutElement(wrapper);

		const [patch] = mockQuickEditSetState.mock.calls[0];
		expect(patch.agentBlock.hasNav).toBe(true);
		expect(patch.agentBlock.hasSiteTitle).toBe(true);
		expect(patch.agentBlock.hasSiteLogo).toBe(true);
		expect(patch.agentBlock.hasImages).toBe(true);
		expect(patch.agentBlock.hasLinks).toBe(true);
	});

	it('skips re-setting agentBlock when called on the already-staged block', async () => {
		// Soft-selection: re-clicking Ask AI on the staged block should
		// just refocus the chat — pushing a new descriptor would churn
		// DOMHighlighter and any workflow that pinned the block.
		mockQuickEditState.agentBlock = {
			id: 'b-1',
			target: 'data-extendify-agent-block-id',
		};
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(wrapper);

		await askAiAboutElement(wrapper);

		expect(mockQuickEditSetState).not.toHaveBeenCalled();
		expect(mockSetOpen).toHaveBeenCalledWith(true);
	});

	it('does set agentBlock when called on a DIFFERENT block from the staged one', async () => {
		mockQuickEditState.agentBlock = {
			id: 'b-1',
			target: 'data-extendify-agent-block-id',
		};
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-2');
		document.body.appendChild(wrapper);

		await askAiAboutElement(wrapper);

		expect(mockQuickEditSetState).toHaveBeenCalledTimes(1);
		const [patch] = mockQuickEditSetState.mock.calls[0];
		expect(patch.agentBlock.id).toBe('b-2');
	});

	it('treats zero-width-space-only content as no text', async () => {
		const { askAiAboutElement } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		wrapper.textContent = '​​';
		document.body.appendChild(wrapper);

		await askAiAboutElement(wrapper);

		const [patch] = mockQuickEditSetState.mock.calls[0];
		expect(patch.agentBlock.hasText).toBe(false);
	});
});

describe('isAgentSidebarOpen — sync-readable cache of the agent open state', () => {
	// The watcher kicks off a dynamic import; let its .then() microtask settle.
	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

	it('stays false and never starts the watcher when the agent is unavailable', async () => {
		mockGlobalState.open = true;
		const { isAgentSidebarOpen } = await import('@quick-edit/lib/ask-ai');
		expect(isAgentSidebarOpen()).toBe(false);
		await flush();
		// The store is open, but the unavailable guard kept the watcher from
		// subscribing — so the cache never picks the true value up.
		expect(isAgentSidebarOpen()).toBe(false);
	});

	it('reads false synchronously before warm-up, then reflects the store once the import resolves', async () => {
		window.extAgentData = {};
		mockGlobalState.open = true;
		const { isAgentSidebarOpen } = await import('@quick-edit/lib/ask-ai');
		// The capture-phase click rule can't await the import — the first sync
		// read returns the stale `false` default (the safe, under-bridging
		// direction), not the store's real `true`.
		expect(isAgentSidebarOpen()).toBe(false);
		await flush();
		expect(isAgentSidebarOpen()).toBe(true);
	});

	it('tracks subsequent open-state changes via the subscription', async () => {
		window.extAgentData = {};
		mockGlobalState.open = true;
		const { isAgentSidebarOpen } = await import('@quick-edit/lib/ask-ai');
		// First read starts the lazy watcher — the same warm-up `attach()`
		// does at mount so the cache is fresh by the user's first click.
		isAgentSidebarOpen();
		await flush();
		expect(isAgentSidebarOpen()).toBe(true);

		mockSetOpen(false);
		expect(isAgentSidebarOpen()).toBe(false);

		mockSetOpen(true);
		expect(isAgentSidebarOpen()).toBe(true);
	});
});

describe('stageAgentBlock — silent stage for the already-open sidebar', () => {
	beforeEach(() => {
		window.extAgentData = {};
	});

	it('no-ops when the agent is unavailable', async () => {
		delete window.extAgentData;
		const { stageAgentBlock } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(wrapper);

		stageAgentBlock(wrapper);

		expect(mockQuickEditSetState).not.toHaveBeenCalled();
	});

	it('no-ops when no tagged ancestor is found', async () => {
		const { stageAgentBlock } = await import('@quick-edit/lib/ask-ai');
		const el = document.createElement('p');
		document.body.appendChild(el);

		stageAgentBlock(el);

		expect(mockQuickEditSetState).not.toHaveBeenCalled();
	});

	it('stages the block and focuses the chat without re-opening the sidebar', async () => {
		const { stageAgentBlock } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(wrapper);

		// Sidebar already open → the textarea is already mounted, so focus
		// lands on the first try (no retry timers).
		const textarea = document.createElement('textarea');
		textarea.id = 'extendify-agent-chat-textarea';
		const focusSpy = jest.spyOn(textarea, 'focus');
		document.body.appendChild(textarea);

		stageAgentBlock(wrapper);

		expect(mockQuickEditSetState).toHaveBeenCalledTimes(1);
		const [patch] = mockQuickEditSetState.mock.calls[0];
		expect(patch.agentBlock).toMatchObject({ id: 'b-1' });
		expect(patch.agentBlockCode).toBeNull();
		expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
		// It must not re-open the sidebar — it's already open.
		expect(mockSetOpen).not.toHaveBeenCalled();
	});

	it('refocuses the chat even when called on the already-staged block', async () => {
		mockQuickEditState.agentBlock = {
			id: 'b-1',
			target: 'data-extendify-agent-block-id',
		};
		const { stageAgentBlock } = await import('@quick-edit/lib/ask-ai');
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(wrapper);

		const textarea = document.createElement('textarea');
		textarea.id = 'extendify-agent-chat-textarea';
		const focusSpy = jest.spyOn(textarea, 'focus');
		document.body.appendChild(textarea);

		stageAgentBlock(wrapper);

		// Same block — don't churn the descriptor, but still refocus.
		expect(mockQuickEditSetState).not.toHaveBeenCalled();
		expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
	});
});
