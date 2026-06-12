// DOMHighlighter draws the agent's selection indicator over the locked
// agent block on the live frontend. These tests pin the render-only
// contracts after the selector unification: enablement gate, rect
// measurement when `agentBlock` is set programmatically (Ask AI), block-
// code fetch lifecycle, X-close clearBlock, and the remove-block-highlight
// event. Hover + click selection live in hover-bar (`click-rule.test.js`).

import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor,
} from '@testing-library/react';

const mockApiFetch = jest.fn();
jest.mock('@wordpress/api-fetch', () => ({
	__esModule: true,
	default: (...args) => mockApiFetch(...args),
}));

let mockWorkflowState;
jest.mock('@agent/state/workflows', () => ({
	useWorkflowStore: () => mockWorkflowState,
}));

let mockQuickEditState;
jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: (selector) => selector(mockQuickEditState),
}));

jest.mock('@agent/hooks/usePortal', () => ({
	usePortal: () => {
		const doc = globalThis.document;
		let node = doc.getElementById('extendify-agent-dom-mount');
		if (!node) {
			node = doc.createElement('div');
			node.id = 'extendify-agent-dom-mount';
		}
		// Mirror the real usePortal: nest inside #extendify-agent-main so
		// the window click-capture handler's panel-guard (closest of that
		// id) excludes the close button and the rect overlay.
		const parent = doc.getElementById('extendify-agent-main') || doc.body;
		if (node.parentNode !== parent) parent.appendChild(node);
		return node;
	},
}));

jest.mock('framer-motion', () => ({
	motion: new Proxy(
		{},
		{
			get:
				() =>
				({ children, animate: _a, transition: _t, initial: _i, ...props }) => (
					<div data-testid="motion-rect" {...props}>
						{children}
					</div>
				),
		},
	),
}));

const stubRect = (el, rect) => {
	const r = {
		top: 10,
		left: 20,
		width: 100,
		height: 50,
		right: 120,
		bottom: 60,
		x: 20,
		y: 10,
		toJSON: () => r,
		...(rect || {}),
	};
	el.getBoundingClientRect = () => r;
	return r;
};

const importComponent = () => require('@agent/components/DOMHighlighter');

let setBlock;
let setBlockCode;

beforeAll(() => {
	if (typeof window.ResizeObserver === 'undefined') {
		window.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	}
});

beforeEach(() => {
	jest.clearAllMocks();
	document.body.innerHTML = '';
	const main = document.createElement('div');
	main.id = 'extendify-agent-main';
	document.body.appendChild(main);
	const wsb = document.createElement('div');
	wsb.className = 'wp-site-blocks';
	document.body.appendChild(wsb);

	setBlock = jest.fn();
	setBlockCode = jest.fn();
	mockWorkflowState = {
		getWorkflowsByFeature: ({ requires } = {}) =>
			requires?.includes('block') ? [{ id: 'wf' }] : [],
	};
	mockQuickEditState = {
		agentBlock: null,
		setAgentBlock: setBlock,
		setAgentBlockCode: setBlockCode,
	};
	mockApiFetch.mockResolvedValue({});
	window.extAgentData = { context: { postId: 42 } };
});

afterEach(() => {
	// wp-scripts' jest preset doesn't register RTL's auto-cleanup, so the
	// previous test's component (and its window listeners) lingers without
	// this.
	cleanup();
	delete window.extAgentData;
});

describe('DOMHighlighter — enablement gate', () => {
	test('renders nothing when no workflows require a block', () => {
		mockWorkflowState.getWorkflowsByFeature = () => [];
		const { DOMHighlighter } = importComponent();
		const { container } = render(<DOMHighlighter />);
		expect(container.firstChild).toBeNull();
		expect(document.querySelector('[data-testid="motion-rect"]')).toBeNull();
	});

	test('adds extendify-agent-highlighter-mode to .wp-site-blocks when enabled', () => {
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		expect(
			document
				.querySelector('.wp-site-blocks')
				.classList.contains('extendify-agent-highlighter-mode'),
		).toBe(true);
	});

	test('removes extendify-agent-highlighter-mode on unmount', () => {
		const { DOMHighlighter } = importComponent();
		const { unmount } = render(<DOMHighlighter />);
		unmount();
		expect(
			document
				.querySelector('.wp-site-blocks')
				.classList.contains('extendify-agent-highlighter-mode'),
		).toBe(false);
	});

	test('adds extendify-agent-busy to .wp-site-blocks when busy', () => {
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter busy />);
		expect(
			document
				.querySelector('.wp-site-blocks')
				.classList.contains('extendify-agent-busy'),
		).toBe(true);
	});
});

describe('DOMHighlighter — programmatic block change (measure effect)', () => {
	test('finds the matching DOM element and renders a rect when block.id is set', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'X-1');
		document.body.appendChild(block);
		stubRect(block, { top: 5, left: 7, width: 30, height: 40 });
		mockQuickEditState.agentBlock = { id: 'X-1' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="motion-rect"]'),
			).not.toBeNull();
		});
	});

	test('respects custom block.target attribute (e.g. data-extendify-part-block-id)', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-part-block-id', 'P-1');
		document.body.appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = {
			id: 'P-1',
			target: 'data-extendify-part-block-id',
		};
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="motion-rect"]'),
			).not.toBeNull();
		});
	});

	test('measure is a no-op when the target element is not in the DOM', () => {
		mockQuickEditState.agentBlock = { id: 'missing' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		expect(document.querySelector('[data-testid="motion-rect"]')).toBeNull();
	});
});

describe('DOMHighlighter — block-code fetch', () => {
	test('GETs extendify/v1/agent/get-block-code with postId + blockId when block.id is set', async () => {
		mockQuickEditState.agentBlock = { id: 'b-9' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
		const arg = mockApiFetch.mock.calls[0][0];
		expect(arg.path).toContain('extendify/v1/agent/get-block-code');
		expect(arg.path).toContain('postId=42');
		expect(arg.path).toContain('blockId=b-9');
		expect(arg.signal).toBeInstanceOf(AbortSignal);
	});

	test('does not fetch when postId is missing', () => {
		window.extAgentData.context.postId = 0;
		mockQuickEditState.agentBlock = { id: 'b-9' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		expect(mockApiFetch).not.toHaveBeenCalled();
	});

	test('does not fetch when block is null', () => {
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		expect(mockApiFetch).not.toHaveBeenCalled();
	});

	test('aborts the in-flight fetch on unmount', async () => {
		let capturedSignal;
		mockApiFetch.mockImplementation(({ signal }) => {
			capturedSignal = signal;
			return new Promise(() => {});
		});
		mockQuickEditState.agentBlock = { id: 'b-9' };
		const { DOMHighlighter } = importComponent();
		const { unmount } = render(<DOMHighlighter />);
		await waitFor(() => expect(capturedSignal).toBeDefined());
		unmount();
		expect(capturedSignal.aborted).toBe(true);
	});

	test('setBlockCode is called with res.block on success', async () => {
		mockApiFetch.mockResolvedValueOnce({
			block: '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
		});
		mockQuickEditState.agentBlock = { id: 'b-9' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() =>
			expect(setBlockCode).toHaveBeenCalledWith(
				'<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
			),
		);
	});

	test('swallows fetch rejection without calling setBlockCode', async () => {
		mockApiFetch.mockRejectedValueOnce(new Error('boom'));
		mockQuickEditState.agentBlock = { id: 'b-9' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 0));
		expect(setBlockCode).not.toHaveBeenCalled();
	});
});

describe('DOMHighlighter — remove-block-highlight event', () => {
	test('extendify-agent:remove-block-highlight clears the rect', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = { id: 'b-1' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() =>
			expect(
				document.querySelector('[data-testid="motion-rect"]'),
			).not.toBeNull(),
		);
		act(() => {
			window.dispatchEvent(
				new CustomEvent('extendify-agent:remove-block-highlight'),
			);
		});
		await waitFor(() =>
			expect(document.querySelector('[data-testid="motion-rect"]')).toBeNull(),
		);
	});
});

// Outline persistence through busy + MutationObserver re-measure.
// Locks the "outline stays visible while the agent is working" contract
// (only the X-close hides). Adds the re-measure path for the case the
// existing ResizeObserver + scroll/resize listeners miss: an AI workflow
// swapping the tagged element via a render_block round-trip, or ancestor
// content mutations that reflow position without changing the element's
// own size.
describe('DOMHighlighter — outline persistence through busy', () => {
	test('outline (motion-rect) stays visible while busy', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'b-busy');
		document.body.appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = { id: 'b-busy' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter busy />);
		await waitFor(() =>
			expect(
				document.querySelector('[data-testid="motion-rect"]'),
			).not.toBeNull(),
		);
	});
});

describe('DOMHighlighter — MutationObserver re-measure', () => {
	let observers;
	let originalMO;
	let originalRaf;
	let originalCancelAnimationFrame;

	beforeEach(() => {
		observers = [];
		originalMO = window.MutationObserver;
		originalRaf = window.requestAnimationFrame;
		originalCancelAnimationFrame = window.cancelAnimationFrame;
		window.MutationObserver = class {
			constructor(cb) {
				this.cb = cb;
				this.target = null;
				this.disconnected = false;
				observers.push(this);
			}
			observe(target) {
				this.target = target;
			}
			disconnect() {
				this.disconnected = true;
			}
			fire() {
				this.cb([], this);
			}
		};
		window.requestAnimationFrame = (cb) => {
			cb();
			return 1;
		};
		window.cancelAnimationFrame = () => {};
	});

	afterEach(() => {
		window.MutationObserver = originalMO;
		window.requestAnimationFrame = originalRaf;
		window.cancelAnimationFrame = originalCancelAnimationFrame;
	});

	test('observes .wp-site-blocks while a block is selected', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'b-mo');
		document.querySelector('.wp-site-blocks').appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = { id: 'b-mo' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() => expect(observers.length).toBeGreaterThan(0));
		const wsb = document.querySelector('.wp-site-blocks');
		const observedWsb = observers.some((o) => o.target === wsb);
		expect(observedWsb).toBe(true);
	});

	test('re-measures when the AI replaces the tagged element with a new node', async () => {
		const wsb = document.querySelector('.wp-site-blocks');
		const original = document.createElement('div');
		original.setAttribute('data-extendify-agent-block-id', 'b-mo');
		wsb.appendChild(original);
		stubRect(original, { top: 5, left: 5, width: 20, height: 10 });
		mockQuickEditState.agentBlock = { id: 'b-mo' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);

		const initialBtn = await waitFor(() => {
			const btn = document.querySelector('[role="button"]');
			expect(btn).not.toBeNull();
			return btn;
		});
		expect(initialBtn.style.top).toBe('5px');

		const replacement = document.createElement('div');
		replacement.setAttribute('data-extendify-agent-block-id', 'b-mo');
		stubRect(replacement, { top: 100, left: 100, width: 80, height: 40 });
		original.replaceWith(replacement);

		act(() => {
			for (const o of observers) {
				if (!o.disconnected) o.fire();
			}
		});

		await waitFor(() => {
			const btn = document.querySelector('[role="button"]');
			expect(btn.style.top).toBe('100px');
		});
	});

	test('disconnects on unmount', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'b-mo');
		document.querySelector('.wp-site-blocks').appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = { id: 'b-mo' };
		const { DOMHighlighter } = importComponent();
		const { unmount } = render(<DOMHighlighter />);
		await waitFor(() => expect(observers.length).toBeGreaterThan(0));
		const last = observers[observers.length - 1];
		unmount();
		expect(last.disconnected).toBe(true);
	});
});

describe('DOMHighlighter — X-close button (clearBlock)', () => {
	test('X-close renders when block && !busy && rect is set', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = { id: 'b-1' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		await waitFor(() =>
			expect(document.querySelector('[role="button"]')).not.toBeNull(),
		);
	});

	test('X-close is hidden while busy', () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = { id: 'b-1' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter busy />);
		expect(document.querySelector('[role="button"]')).toBeNull();
	});

	test('X-close click calls setBlock(null)', async () => {
		const block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'b-1');
		document.body.appendChild(block);
		stubRect(block);
		mockQuickEditState.agentBlock = { id: 'b-1' };
		const { DOMHighlighter } = importComponent();
		render(<DOMHighlighter />);
		const closeBtn = await waitFor(() => {
			const btn = document.querySelector('[role="button"]');
			expect(btn).not.toBeNull();
			return btn;
		});
		fireEvent.click(closeBtn);
		expect(setBlock).toHaveBeenCalledWith(null);
	});
});
