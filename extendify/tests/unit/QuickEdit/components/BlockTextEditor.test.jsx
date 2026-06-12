// BlockTextEditor is the rebuild's schema-driven inline editor: it loads
// the live block's raw markup, mounts a Gutenberg BlockEditor inside a
// sibling DOM host, and on save serializes back, calls the save API,
// splices the rendered HTML into the page, pushes an undo entry, and
// fires an insights event. These tests pin those contracts plus the
// keyboard surface (Cmd/Ctrl+Enter saves, Escape cancels) and the
// load / save sad paths.

import { act, fireEvent, render, waitFor } from '@testing-library/react';

const mockSave = jest.fn();
const mockGetBlockSource = jest.fn();
const mockInvalidateBlockSource = jest.fn();
const mockSplice = jest.fn();
const mockTrack = jest.fn();
const mockFetchLinkSuggestions = jest.fn();
const mockPushUndo = jest.fn();
const mockClearSelected = jest.fn();
const mockAskAiAboutElement = jest.fn();
const mockIsAgentAvailable = jest.fn(() => false);
const mockIsAgentEligibleForTarget = jest.fn(() => true);
const mockResetBlocks = jest.fn();
const mockClearSelectedBlock = jest.fn();
const mockResetSelection = jest.fn();
const mockSelectBlock = jest.fn();
const mockSelectionChange = jest.fn();
// Drives AutoSelectFirstBlock's useSelect; null → the editor reports an empty
// block order so AutoSelectFirstBlock no-ops.
let mockFirstBlock = null;

let capturedProviderProps = null;

jest.mock('@quick-edit/lib/api', () => ({
	save: (...args) => mockSave(...args),
}));
jest.mock('@quick-edit/lib/block-source-cache', () => ({
	getBlockSource: (...args) => mockGetBlockSource(...args),
	invalidateBlockSource: (...args) => mockInvalidateBlockSource(...args),
}));
jest.mock('@quick-edit/lib/dom', () => ({
	splice: (...args) => mockSplice(...args),
}));
jest.mock('@quick-edit/lib/insights', () => ({
	track: (...args) => mockTrack(...args),
}));
jest.mock('@quick-edit/lib/link-suggestions', () => ({
	fetchLinkSuggestions: (...args) => mockFetchLinkSuggestions(...args),
}));
jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: (selector) =>
		selector({ clearSelected: mockClearSelected }),
}));
jest.mock('@quick-edit/lib/ask-ai', () => ({
	askAiAboutElement: (...args) => mockAskAiAboutElement(...args),
	isAgentAvailable: () => mockIsAgentAvailable(),
}));
jest.mock('@quick-edit/lib/agent-gate', () => ({
	isAgentEligibleForTarget: (...args) => mockIsAgentEligibleForTarget(...args),
}));
jest.mock('@quick-edit/state/undo', () => ({
	pushUndo: (...args) => mockPushUndo(...args),
}));
jest.mock('@quick-edit/components/toolbar/ColorButton', () => ({
	ColorButton: ({ kind, label }) => (
		<button type="button" data-testid={`color-${kind}`}>
			{label}
		</button>
	),
}));
jest.mock('@quick-edit/components/toolbar/HeadingLevelButton', () => ({
	HeadingLevelButton: () => (
		<button type="button" data-testid="heading-level-button" />
	),
}));
jest.mock('@quick-edit/components/toolbar/TextAlignButtons', () => ({
	TextAlignButtons: () => <div data-testid="text-align-buttons" />,
}));

jest.mock('@wordpress/block-library', () => ({
	registerCoreBlocks: jest.fn(),
}));

const mockParse = jest.fn((raw) => [
	{ name: 'core/paragraph', _raw: raw, attributes: {} },
]);
const mockSerialize = jest.fn(
	() => '<!-- wp:paragraph --><p>edited</p><!-- /wp:paragraph -->',
);
jest.mock('@wordpress/blocks', () => ({
	parse: (...args) => mockParse(...args),
	serialize: (...args) => mockSerialize(...args),
}));

jest.mock('@wordpress/data', () => ({
	useSelect: (fn) =>
		fn(() => ({
			getBlockOrder: () => (mockFirstBlock ? [mockFirstBlock.clientId] : []),
			getBlock: (clientId) =>
				mockFirstBlock && clientId === mockFirstBlock.clientId
					? {
							name: mockFirstBlock.name,
							attributes: mockFirstBlock.attributes,
						}
					: null,
		})),
	useDispatch: () => ({
		selectBlock: mockSelectBlock,
		selectionChange: mockSelectionChange,
		resetBlocks: mockResetBlocks,
		clearSelectedBlock: mockClearSelectedBlock,
		resetSelection: mockResetSelection,
	}),
	// AutoSelectFirstBlock reads the first block's attributes imperatively via
	// the registry (not the reactive useSelect) so it doesn't re-run per
	// keystroke.
	useRegistry: () => ({
		select: (store) =>
			store === 'core/block-editor'
				? {
						getBlock: (clientId) =>
							mockFirstBlock && clientId === mockFirstBlock.clientId
								? {
										name: mockFirstBlock.name,
										attributes: mockFirstBlock.attributes,
									}
								: null,
					}
				: null,
	}),
}));

jest.mock('@wordpress/block-editor', () => ({
	BlockEditorProvider: (props) => {
		capturedProviderProps = props;
		return <div data-testid="block-editor-provider">{props.children}</div>;
	},
	BlockList: () => <div data-testid="block-list" />,
	BlockToolbar: ({ hideDragHandle }) => (
		<div
			data-testid="block-toolbar"
			data-hide-drag={String(!!hideDragHandle)}
		/>
	),
	BlockTools: ({ children }) => <div data-testid="block-tools">{children}</div>,
	ObserveTyping: ({ children }) => <>{children}</>,
	WritingFlow: ({ children }) => <>{children}</>,
}));

jest.mock('@wordpress/components', () => ({
	Popover: {
		Slot: ({ name }) => (
			<div data-testid="popover-slot" data-slot-name={name} />
		),
	},
}));

beforeAll(() => {
	if (typeof window.ResizeObserver === 'undefined') {
		window.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	}
});

let liveEl;
let selected;

const makeLive = () => {
	const parent = document.createElement('div');
	parent.style.position = 'relative';
	const el = document.createElement('p');
	el.className = 'wp-block-paragraph';
	el.dataset.block = 'b-1';
	el.textContent = 'original';
	parent.appendChild(el);
	document.body.appendChild(parent);
	return el;
};

beforeEach(() => {
	jest.clearAllMocks();
	mockFirstBlock = null;
	capturedProviderProps = null;
	document.body.innerHTML = '';
	liveEl = makeLive();
	selected = {
		el: liveEl,
		blockId: 'b-1',
		blockType: 'core/paragraph',
		source: { kind: 'post', id: 42 },
	};
	mockGetBlockSource.mockResolvedValue({
		block: '<!-- wp:paragraph --><p>original</p><!-- /wp:paragraph -->',
	});
});

const importComponent = () => require('@quick-edit/components/BlockTextEditor');

const waitForSaveButton = async () => {
	await waitFor(() => {
		expect(
			document.querySelector('[data-test="quick-edit-save"]'),
		).not.toBeNull();
	});
};

describe('BlockTextEditor — mount lifecycle', () => {
	it('renders nothing on the first paint (waits for the sibling host)', async () => {
		const { BlockTextEditor } = importComponent();
		const { container } = render(<BlockTextEditor selected={selected} />);
		expect(container.firstChild).toBeNull();
		// flush the host mount effect before the test exits
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-host"]'),
			).not.toBeNull();
		});
	});

	it('inserts a sibling host node next to selected.el on mount', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-host"]'),
			).not.toBeNull();
		});
		const host = document.querySelector('[data-test="quick-edit-host"]');
		expect(host.parentNode).toBe(liveEl.parentNode);
	});

	it('appends the floating toolbar host to document.body', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-floating-bar"]'),
			).not.toBeNull();
		});
		const bar = document.querySelector('[data-test="quick-edit-floating-bar"]');
		expect(bar.parentNode).toBe(document.body);
		expect(bar.getAttribute('role')).toBe('toolbar');
	});

	it('removes the sibling host + floating bar on unmount', async () => {
		const { BlockTextEditor } = importComponent();
		const { unmount } = render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-host"]'),
			).not.toBeNull();
		});
		unmount();
		expect(document.querySelector('[data-test="quick-edit-host"]')).toBeNull();
		expect(
			document.querySelector('[data-test="quick-edit-floating-bar"]'),
		).toBeNull();
	});
});

describe('BlockTextEditor — block source load', () => {
	it('fetches the live block markup via getBlockSource(source, blockId)', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(mockGetBlockSource).toHaveBeenCalledWith(
				{ kind: 'post', id: 42 },
				'b-1',
			);
		});
	});

	it('fetches a template-part source through the same loader', async () => {
		selected.source = { kind: 'template-part', partSlug: 'header' };
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(mockGetBlockSource).toHaveBeenCalledWith(
				{ kind: 'template-part', partSlug: 'header' },
				'b-1',
			);
		});
	});

	it('skips the fetch for sources loaded through other editors (e.g. product)', () => {
		selected.source = { kind: 'product', id: 7 };
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		expect(mockGetBlockSource).not.toHaveBeenCalled();
	});

	it('parses + mounts the editor once the source resolves', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="block-editor-provider"]'),
			).not.toBeNull();
		});
		expect(mockParse).toHaveBeenCalledWith(
			'<!-- wp:paragraph --><p>original</p><!-- /wp:paragraph -->',
		);
	});

	it('renders an error pill when the source fetch rejects', async () => {
		mockGetBlockSource.mockRejectedValueOnce(new Error('boom'));
		const { BlockTextEditor } = importComponent();
		const { findByText } = render(<BlockTextEditor selected={selected} />);
		await findByText(/Sorry, something went wrong/i);
	});

	it('error pill × button calls clearSelected', async () => {
		mockGetBlockSource.mockRejectedValueOnce(new Error('boom'));
		const { BlockTextEditor } = importComponent();
		const { findByText } = render(<BlockTextEditor selected={selected} />);
		await findByText(/Sorry, something went wrong/i);
		fireEvent.click(document.querySelector('button'));
		expect(mockClearSelected).toHaveBeenCalledTimes(1);
	});
});

describe('BlockTextEditor — toolbar mount + link suggestions', () => {
	it('renders the BlockToolbar (hideDragHandle) inside the floating bar', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="block-toolbar"]'),
			).not.toBeNull();
		});
		const toolbar = document.querySelector('[data-testid="block-toolbar"]');
		expect(toolbar.getAttribute('data-hide-drag')).toBe('true');
		expect(
			toolbar.closest('[data-test="quick-edit-floating-bar-inner"]'),
		).not.toBeNull();
	});

	it('renders both text + highlight ColorButtons next to the toolbar', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="color-text"]'),
			).not.toBeNull();
		});
		expect(
			document.querySelector('[data-testid="color-highlight"]'),
		).not.toBeNull();
	});

	it('renders the HeadingLevelButton only for core/heading blocks', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="color-text"]'),
			).not.toBeNull();
		});
		expect(
			document.querySelector('[data-testid="heading-level-button"]'),
		).toBeNull();
	});

	it('renders the HeadingLevelButton for a core/heading block', async () => {
		selected = { ...selected, blockType: 'core/heading' };
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="heading-level-button"]'),
			).not.toBeNull();
		});
	});

	it('wires fetchLinkSuggestions into the BlockEditorProvider settings', async () => {
		const { BlockTextEditor } = importComponent();
		const {
			fetchLinkSuggestions,
		} = require('@quick-edit/lib/link-suggestions');
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(capturedProviderProps).not.toBeNull();
		});
		expect(
			capturedProviderProps.settings.__experimentalFetchLinkSuggestions,
		).toBe(fetchLinkSuggestions);
		expect(capturedProviderProps.settings.hasFixedToolbar).toBe(true);
	});
});

// Pin the body-level slot: document.body escapes sticky-header clipping, and
// the positioned wrapper keeps the popover on-anchor under the admin bar margin.
describe('BlockTextEditor — body-level rich-text popover slot', () => {
	it('portals a __unstable-block-tools-after Popover.Slot to document.body inside a positioned wrapper', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="block-editor-provider"]'),
			).not.toBeNull();
		});
		const slot = document.querySelector(
			'[data-testid="popover-slot"][data-slot-name="__unstable-block-tools-after"]',
		);
		expect(slot).not.toBeNull();
		const wrapper = slot.parentNode;
		expect(wrapper.className).toBe('extendify-quick-edit-popover-slot');
		expect(wrapper.parentNode).toBe(document.body);
	});
});

// A header phone CTA is a core/paragraph whose entire text is a `tel:` link —
// an inline rich-text format, unlike a button's block-level link. At a collapsed
// caret (offset 0) the core/link format isn't active (getActiveFormats returns
// the empty set before the first character), so WP shows plain text and the
// toolbar link button would create a NEW link. Selecting the whole link range
// makes core/link active, so WP surfaces its inline link editor on open and the
// toolbar edits the existing link — parity with a button, whose block-level link
// surfaces immediately. A plain or only-partly-linked paragraph stays at a
// collapsed caret so no spurious link UI appears.
describe('BlockTextEditor — surfacing an existing single-link paragraph', () => {
	const stubRichText = (text, linkLength) => {
		window.wp = {
			...(window.wp || {}),
			richText: {
				create: () => ({
					text,
					formats: Array.from({ length: text.length }, (_, i) =>
						i < linkLength ? [{ type: 'core/link', attributes: {} }] : [],
					),
				}),
			},
		};
	};

	afterEach(() => {
		delete window.wp;
	});

	it('selects the whole link so WP surfaces the inline link editor on open', async () => {
		const phone = '01 23 45 67 89';
		stubRichText(phone, phone.length);
		mockFirstBlock = {
			clientId: 'cid-link',
			name: 'core/paragraph',
			attributes: { content: `<a href="tel:0123456789">${phone}</a>` },
		};
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() =>
			expect(mockSelectionChange).toHaveBeenCalledWith(
				'cid-link',
				'content',
				0,
				phone.length,
			),
		);
	});

	it('leaves a plain paragraph at a collapsed caret (no spurious link UI)', async () => {
		stubRichText('Just some text', 0);
		mockFirstBlock = {
			clientId: 'cid-plain',
			name: 'core/paragraph',
			attributes: { content: 'Just some text' },
		};
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() =>
			expect(mockSelectionChange).toHaveBeenCalledWith(
				'cid-plain',
				'content',
				0,
				0,
			),
		);
	});

	it('leaves a partially-linked paragraph at a collapsed caret', async () => {
		const text = 'Call us here';
		// Only the first 4 characters carry the link — not a single full link.
		stubRichText(text, 4);
		mockFirstBlock = {
			clientId: 'cid-partial',
			name: 'core/paragraph',
			attributes: { content: '<a href="tel:1">Call</a> us here' },
		};
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() =>
			expect(mockSelectionChange).toHaveBeenCalledWith(
				'cid-partial',
				'content',
				0,
				0,
			),
		);
	});

	// Single-link detection runs on every block open; skip the rich-text parse
	// for anchor-less content (the common case) so a plain paragraph doesn't pay
	// it. Pins the cheap pre-check that keeps the parse off the open hot path.
	it('skips the rich-text parse for content with no anchor', async () => {
		const create = jest.fn();
		window.wp = { richText: { create } };
		mockFirstBlock = {
			clientId: 'cid-nolink',
			name: 'core/paragraph',
			attributes: { content: 'Just plain text, no link at all' },
		};
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() =>
			expect(mockSelectionChange).toHaveBeenCalledWith(
				'cid-nolink',
				'content',
				0,
				0,
			),
		);
		expect(create).not.toHaveBeenCalled();
	});
});

// The floating bar is fixed-positioned and ~600px wide once its toolbar
// groups render — but at the first synchronous align() the bar is still 0px
// (the toolbar content hasn't portaled in yet), so the right-edge clamp
// no-ops. The bar must be observed for resize (not just the live element,
// whose size never changes when the bar fills in) or the clamp never
// recomputes and a right-edge CTA's bar runs off the page.
describe('BlockTextEditor — floating bar viewport clamp', () => {
	let roInstances;
	let origRO;
	let origRaf;

	const fireResizeFor = (el) => {
		for (const ro of roInstances) {
			if (ro.targets.has(el)) ro.cb([{ target: el }], ro);
		}
	};

	beforeEach(() => {
		roInstances = [];
		origRO = window.ResizeObserver;
		window.ResizeObserver = class {
			constructor(cb) {
				this.cb = cb;
				this.targets = new Set();
				roInstances.push(this);
			}
			observe(el) {
				this.targets.add(el);
			}
			unobserve(el) {
				this.targets.delete(el);
			}
			disconnect() {
				this.targets.clear();
			}
		};
		// The rAF re-aligns are resilience; no-op them so the only post-mount
		// align path under test is the ResizeObserver notification.
		origRaf = window.requestAnimationFrame;
		window.requestAnimationFrame = () => 0;
	});

	afterEach(() => {
		window.ResizeObserver = origRO;
		window.requestAnimationFrame = origRaf;
		delete document.documentElement.clientWidth;
	});

	it('observes the floating bar so the clamp recomputes once the toolbar has width', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-floating-bar"]'),
			).not.toBeNull();
		});
		const bar = document.querySelector('[data-test="quick-edit-floating-bar"]');
		expect(roInstances.some((ro) => ro.targets.has(bar))).toBe(true);
	});

	it('shifts the bar left to stay on-screen once it gains width near the right edge', async () => {
		// Live element jammed against the right edge of a 1400px viewport.
		Object.defineProperty(document.documentElement, 'clientWidth', {
			configurable: true,
			value: 1400,
		});
		liveEl.getBoundingClientRect = () => ({
			left: 1298,
			top: 100,
			width: 80,
			height: 30,
			right: 1378,
			bottom: 130,
		});
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-floating-bar"]'),
			).not.toBeNull();
		});
		const bar = document.querySelector('[data-test="quick-edit-floating-bar"]');
		const host = document.querySelector('[data-test="quick-edit-host"]');
		// jsdom reports 0 for all layout; supply a positioned offsetParent so
		// align() runs past its guard, and a real bar width so the clamp fires.
		Object.defineProperty(host, 'offsetParent', {
			configurable: true,
			get: () => host.parentNode,
		});
		Object.defineProperty(bar, 'offsetWidth', {
			configurable: true,
			get: () => 600,
		});
		// Toolbar content has now portaled in → the bar resized. Notify.
		act(() => fireResizeFor(bar));
		// 1298 + 600 overflows 1400; clamp to vw - bw - 4 = 796.
		expect(bar.style.left).toBe('796px');
	});
});

describe('BlockTextEditor — save round-trip (happy path)', () => {
	beforeEach(() => {
		mockSave.mockResolvedValue({ rendered: '<p>edited</p>' });
		mockSplice.mockReturnValue(document.createElement('p'));
	});

	it('serializes the editor blocks and calls save() with the selection envelope', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => expect(mockSave).toHaveBeenCalled());
		expect(mockSave).toHaveBeenCalledWith({
			source: { kind: 'post', id: 42 },
			blockId: 'b-1',
			blockType: 'core/paragraph',
			rawBlock: '<!-- wp:paragraph --><p>edited</p><!-- /wp:paragraph -->',
			fingerprint: { text: 'original' },
		});
	});

	// The same-type misresolve guard's client half: the save carries the
	// pre-edit visible text of the clicked element so the server can 409 when
	// its block count resolves to a different paragraph of the same type.
	it('attaches a content fingerprint (pre-edit text of the clicked element)', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => expect(mockSave).toHaveBeenCalled());
		expect(mockSave.mock.calls[0][0]).toMatchObject({
			fingerprint: { text: 'original' },
		});
	});

	it('splices the rendered HTML into the live element', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => expect(mockSplice).toHaveBeenCalled());
		expect(mockSplice).toHaveBeenCalledWith(liveEl, '<p>edited</p>');
	});

	it('invalidates the block-source cache after a successful save', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() =>
			expect(mockInvalidateBlockSource).toHaveBeenCalledWith(
				{ kind: 'post', id: 42 },
				'b-1',
			),
		);
	});

	it('pushes a "block" undo entry carrying the pre-edit raw markup', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => expect(mockPushUndo).toHaveBeenCalled());
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'block',
			source: { kind: 'post', id: 42 },
			blockId: 'b-1',
			blockType: 'core/paragraph',
			rawBlock: '<!-- wp:paragraph --><p>original</p><!-- /wp:paragraph -->',
		});
	});

	it('emits insights track("save", { kind: "block", blockType })', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() =>
			expect(mockTrack).toHaveBeenCalledWith('save', {
				kind: 'block',
				blockType: 'core/paragraph',
			}),
		);
	});

	it('clears the selected store entry on save success', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => expect(mockClearSelected).toHaveBeenCalledTimes(1));
	});
});

describe('BlockTextEditor — save sad paths', () => {
	it('emits track("save_failed", …) and surfaces the error message when save rejects', async () => {
		const err = new Error('5xx');
		err.status = 500;
		mockSave.mockRejectedValueOnce(err);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() =>
			expect(mockTrack).toHaveBeenCalledWith('save_failed', {
				kind: 'block',
				blockType: 'core/paragraph',
				reason: 500,
			}),
		);
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-canvas-error"]'),
			).not.toBeNull();
		});
		expect(mockClearSelected).not.toHaveBeenCalled();
	});

	it('throws + surfaces error when the save response is missing rendered HTML', async () => {
		mockSave.mockResolvedValueOnce({});
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-canvas-error"]'),
			).not.toBeNull();
		});
		expect(mockSplice).not.toHaveBeenCalled();
		expect(mockClearSelected).not.toHaveBeenCalled();
	});

	it('throws + surfaces error when splice returns null', async () => {
		mockSave.mockResolvedValueOnce({ rendered: '<p>x</p>' });
		mockSplice.mockReturnValueOnce(null);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-canvas-error"]'),
			).not.toBeNull();
		});
		expect(mockClearSelected).not.toHaveBeenCalled();
	});

	// Every QE save
	// failure shows one generic friendly message instead of the raw backend
	// diagnostic; an expired REST nonce gets a refresh-specific message.
	it('shows the generic friendly message (not the raw diagnostic) when save rejects with a backend error', async () => {
		const err = new Error('rawBlock must parse to exactly one block');
		err.status = 400;
		err.body = { error: 'rawBlock must parse to exactly one block' };
		mockSave.mockRejectedValueOnce(err);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => {
			const errEl = document.querySelector(
				'[data-test="quick-edit-canvas-error"]',
			);
			expect(errEl).not.toBeNull();
			expect(errEl.textContent).toMatch(/Sorry, something went wrong/i);
		});
		expect(
			document.querySelector('[data-test="quick-edit-canvas-error"]')
				.textContent,
		).not.toMatch(/rawBlock must parse/);
	});

	it('shows the session-expiry message when save rejects with an expired REST nonce', async () => {
		const err = new Error('Cookie check failed');
		err.status = 403;
		err.body = {
			code: 'rest_cookie_invalid_nonce',
			message: 'Cookie check failed',
		};
		mockSave.mockRejectedValueOnce(err);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => {
			const errEl = document.querySelector(
				'[data-test="quick-edit-canvas-error"]',
			);
			expect(errEl).not.toBeNull();
			expect(errEl.textContent).toMatch(/Your session expired/i);
		});
	});
});

describe('BlockTextEditor — keyboard surface', () => {
	const fireDocKey = (init) => {
		const e = new KeyboardEvent('keydown', {
			bubbles: true,
			cancelable: true,
			...init,
		});
		// Native dispatch sidesteps RTL's auto-act wrapping; wrap manually
		// so the resulting React state updates flush inside act().
		act(() => {
			document.dispatchEvent(e);
		});
		return e;
	};

	it('Cmd+Enter triggers save', async () => {
		mockSave.mockResolvedValue({ rendered: '<p>e</p>' });
		mockSplice.mockReturnValue(document.createElement('p'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireDocKey({ key: 'Enter', metaKey: true });
		await waitFor(() => expect(mockSave).toHaveBeenCalled());
	});

	it('Ctrl+Enter triggers save', async () => {
		mockSave.mockResolvedValue({ rendered: '<p>e</p>' });
		mockSplice.mockReturnValue(document.createElement('p'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireDocKey({ key: 'Enter', ctrlKey: true });
		await waitFor(() => expect(mockSave).toHaveBeenCalled());
	});

	// A header phone paragraph's inline-format link and a button's block-level
	// link both edit through WP's LinkControl (wrapper `.block-editor-link-control`),
	// which holds the typed URL in its own state until the popover commits.
	// Cmd+Enter must reach the popover so it applies — not save the block with
	// the stale href and discard the edit.
	it('Cmd+Enter inside an open link popover does not hijack the key', async () => {
		mockSave.mockResolvedValue({ rendered: '<p>e</p>' });
		mockSplice.mockReturnValue(document.createElement('p'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();

		// The real popover portals to document.body, outside the editor host.
		const popover = document.createElement('div');
		popover.className = 'block-editor-link-control';
		const input = document.createElement('input');
		popover.appendChild(input);
		document.body.appendChild(popover);

		const e = new KeyboardEvent('keydown', {
			key: 'Enter',
			metaKey: true,
			bubbles: true,
			cancelable: true,
		});
		act(() => {
			input.dispatchEvent(e);
		});

		expect(mockSave).not.toHaveBeenCalled();
		// Left for the popover to handle — not swallowed by the capture listener.
		expect(e.defaultPrevented).toBe(false);
	});

	it('plain Enter does not trigger save', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireDocKey({ key: 'Enter' });
		expect(mockSave).not.toHaveBeenCalled();
	});

	it('Escape clears the selected store entry', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireDocKey({ key: 'Escape' });
		expect(mockClearSelected).toHaveBeenCalledTimes(1);
	});
});

// Plain Return inside
// the canvas becomes a soft line break (`<br>`), not a new paragraph block.
// Keeps blocks.length === 1 so the single-block splice path handles every
// save (no reload, no server-side multi-block dance) and the saved markup
// matches the spacing the user sees while editing.
//
// The handler inserts the `<br>` via the Selection API (so the DOM has it)
// then dispatches `input` with `inputType: 'insertLineBreak'` — RichText's
// input listener syncs its internal record from the DOM for that inputType.
// Without that signal the React re-render would erase the inserted `<br>`.
describe('BlockTextEditor — Return maps to soft line break', () => {
	const installEditable = (host) => {
		const editable = document.createElement('div');
		editable.setAttribute('contenteditable', 'true');
		editable.textContent = 'hello';
		host.appendChild(editable);
		const range = document.createRange();
		range.setStart(editable.firstChild, 5);
		range.collapse(true);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		return editable;
	};

	const fireKeyOn = (el, init) => {
		const e = new KeyboardEvent('keydown', {
			bubbles: true,
			cancelable: true,
			...init,
		});
		const prevented = jest.fn();
		const original = e.preventDefault.bind(e);
		e.preventDefault = () => {
			prevented();
			original();
		};
		act(() => {
			el.dispatchEvent(e);
		});
		return { event: e, prevented };
	};

	it('plain Enter inside the canvas inserts a <br> and dispatches insertLineBreak input', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const host = document.querySelector('[data-test="quick-edit-host"]');
		expect(host).not.toBeNull();
		const editable = installEditable(host);
		const inputs = [];
		editable.addEventListener('input', (e) => {
			inputs.push({ inputType: e.inputType, bubbles: e.bubbles });
		});

		const { prevented } = fireKeyOn(editable, { key: 'Enter' });

		expect(prevented).toHaveBeenCalled();
		const br = editable.querySelector('br');
		expect(br).not.toBeNull();
		// rich-text/create.cjs ignores <br> elements without this attribute
		// when reading the DOM back into a record, so without it the value
		// React re-renders from has no line break and the <br> is reverted.
		expect(br.getAttribute('data-rich-text-line-break')).toBe('true');
		expect(inputs).toEqual([{ inputType: 'insertLineBreak', bubbles: true }]);
	});

	it('Shift+Enter inside the canvas is left to Gutenberg', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const host = document.querySelector('[data-test="quick-edit-host"]');
		const editable = installEditable(host);
		fireKeyOn(editable, { key: 'Enter', shiftKey: true });
		expect(editable.querySelector('br')).toBeNull();
	});

	it('plain Enter outside the canvas is not hijacked', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const outside = document.createElement('div');
		outside.setAttribute('contenteditable', 'true');
		outside.textContent = 'outside';
		document.body.appendChild(outside);
		fireKeyOn(outside, { key: 'Enter' });
		expect(outside.querySelector('br')).toBeNull();
	});
});

describe('BlockTextEditor — Cancel + Save buttons', () => {
	it('Cancel button calls clearSelected without saving', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitFor(() => {
			expect(
				document.querySelector('[data-test="quick-edit-cancel"]'),
			).not.toBeNull();
		});
		fireEvent.click(document.querySelector('[data-test="quick-edit-cancel"]'));
		expect(mockClearSelected).toHaveBeenCalledTimes(1);
		expect(mockSave).not.toHaveBeenCalled();
	});

	// Cross-block click fires handleSave({ alsoClear:
	// false }). Without the optimistic write, the live element's pre-edit
	// text flashes back into view between the canvas unmount and save's
	// splice. Pin the write + the failure-path revert.
	it('cross-block save (alsoClear: false) optimistically writes the editable into live before splice', async () => {
		// Never-resolving save so the optimistic prefix has time to land
		// without the splice masking it.
		mockSave.mockReturnValueOnce(new Promise(() => {}));
		mockSplice.mockReturnValue(document.createElement('p'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();

		const host = document.querySelector('[data-test="quick-edit-host"]');
		const editable = document.createElement('p');
		editable.className = 'block-editor-rich-text__editable';
		editable.innerHTML = 'edited via cross-block';
		host.appendChild(editable);

		const { saveSelected } = require('@quick-edit/lib/save-bridge');
		act(() => {
			saveSelected({ alsoClear: false });
		});

		expect(liveEl.innerHTML).toBe('edited via cross-block');
	});

	it('cross-block save failure reverts the optimistic write', async () => {
		mockSave.mockRejectedValueOnce(new Error('boom'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();

		const originalHtml = liveEl.innerHTML;
		const host = document.querySelector('[data-test="quick-edit-host"]');
		const editable = document.createElement('p');
		editable.className = 'block-editor-rich-text__editable';
		editable.innerHTML = 'edited via cross-block';
		host.appendChild(editable);

		const { saveSelected } = require('@quick-edit/lib/save-bridge');
		await act(async () => {
			await saveSelected({ alsoClear: false });
		});

		expect(liveEl.innerHTML).toBe(originalHtml);
	});

	it('Save button label flips to "Saving…" while a save is in flight', async () => {
		let resolveSave;
		mockSave.mockReturnValueOnce(
			new Promise((r) => {
				resolveSave = r;
			}),
		);
		mockSplice.mockReturnValue(document.createElement('p'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const saveBtn = document.querySelector('[data-test="quick-edit-save"]');
		fireEvent.click(saveBtn);
		await waitFor(() => expect(saveBtn.textContent).toMatch(/Saving/));
		resolveSave({ rendered: '<p>x</p>' });
	});
});

// The Ask AI pill relocates from the hover bar onto
// the QE chrome (right side of Cancel / Save) so the user can escalate
// from QE to the agent without leaving the editing canvas.
describe('BlockTextEditor — Ask AI chrome button', () => {
	beforeEach(() => {
		mockIsAgentAvailable.mockReturnValue(false);
		mockIsAgentEligibleForTarget.mockReturnValue(true);
	});

	it('does not render the Ask AI button when the agent is unavailable', async () => {
		mockIsAgentAvailable.mockReturnValue(false);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		expect(
			document.querySelector('[data-test="quick-edit-ask-ai"]'),
		).toBeNull();
	});

	it('does not render the Ask AI button when the block fails agent eligibility', async () => {
		mockIsAgentAvailable.mockReturnValue(true);
		mockIsAgentEligibleForTarget.mockReturnValue(false);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		expect(
			document.querySelector('[data-test="quick-edit-ask-ai"]'),
		).toBeNull();
	});

	it('renders the Ask AI button on an agent-eligible post-source block', async () => {
		mockIsAgentAvailable.mockReturnValue(true);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		expect(
			document.querySelector('[data-test="quick-edit-ask-ai"]'),
		).not.toBeNull();
	});

	// Save is the most-common action, so it sits last/rightmost in the
	// cluster; Ask AI leads.
	it('orders the action cluster Ask AI → Cancel → Save', async () => {
		mockIsAgentAvailable.mockReturnValue(true);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const ai = document.querySelector('[data-test="quick-edit-ask-ai"]');
		const cancel = document.querySelector('[data-test="quick-edit-cancel"]');
		const save = document.querySelector('[data-test="quick-edit-save"]');
		expect(
			ai.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			cancel.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	// Save must complete (with its own clearSelected)
	// BEFORE askAiAboutElement fires. Parallel-firing the two leaves the
	// hover-bar's same-block bridge a window to read save's
	// setSelected(null) as "user dismissed the canvas" and clear the
	// agentBlock askAi just staged.
	it('Ask AI button click awaits save (with clearSelected) before askAiAboutElement', async () => {
		mockIsAgentAvailable.mockReturnValue(true);
		let resolveSave;
		mockSave.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveSave = resolve;
			}),
		);
		mockSplice.mockReturnValue(document.createElement('p'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const aiBtn = document.querySelector('[data-test="quick-edit-ask-ai"]');
		expect(aiBtn).not.toBeNull();
		fireEvent.click(aiBtn);
		await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
		expect(mockAskAiAboutElement).not.toHaveBeenCalled();
		await act(() => {
			resolveSave({ rendered: '<p>x</p>' });
		});
		await waitFor(() =>
			expect(mockAskAiAboutElement).toHaveBeenCalledWith(liveEl),
		);
		expect(mockClearSelected.mock.invocationCallOrder[0]).toBeLessThan(
			mockAskAiAboutElement.mock.invocationCallOrder[0],
		);
	});
});

// Status / error announcements + dismiss
// labels. The save-error and load-error nodes must announce assertively
// (role="alert"); the saving status is a polite live region that takes focus
// before the Save button disables so focus is never stranded on a disabled
// control; the error-pill × needs an accessible name.
describe('BlockTextEditor — a11y status + error announcements', () => {
	it('renders the canvas save-error as role="alert"', async () => {
		const err = new Error('5xx');
		err.status = 500;
		mockSave.mockRejectedValueOnce(err);
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		fireEvent.click(document.querySelector('[data-test="quick-edit-save"]'));
		await waitFor(() => {
			const errEl = document.querySelector(
				'[data-test="quick-edit-canvas-error"]',
			);
			expect(errEl).not.toBeNull();
			expect(errEl.getAttribute('role')).toBe('alert');
		});
	});

	it('exposes a polite saving status region (role="status")', async () => {
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const status = document.querySelector(
			'.extendify-quick-edit-floating-status',
		);
		expect(status).not.toBeNull();
		expect(status.getAttribute('role')).toBe('status');
		expect(status.getAttribute('aria-live')).toBe('polite');
	});

	it('moves focus to the status region before the Save button disables, then announces "Saving…"', async () => {
		// Never-resolving save keeps the in-flight (saving) state mounted.
		mockSave.mockReturnValueOnce(new Promise(() => {}));
		mockSplice.mockReturnValue(document.createElement('p'));
		const { BlockTextEditor } = importComponent();
		render(<BlockTextEditor selected={selected} />);
		await waitForSaveButton();
		const saveBtn = document.querySelector('[data-test="quick-edit-save"]');
		saveBtn.focus();
		expect(document.activeElement).toBe(saveBtn);
		fireEvent.click(saveBtn);
		const status = document.querySelector(
			'.extendify-quick-edit-floating-status',
		);
		expect(document.activeElement).toBe(status);
		expect(saveBtn.disabled).toBe(true);
		await waitFor(() => expect(status.textContent).toMatch(/Saving/));
	});

	it('load-error pill is role="alert" with an accessible Dismiss button', async () => {
		mockGetBlockSource.mockRejectedValueOnce(new Error('boom'));
		const { BlockTextEditor } = importComponent();
		const { findByText } = render(<BlockTextEditor selected={selected} />);
		await findByText(/Sorry, something went wrong/i);
		const pill = document.querySelector('[role="alert"]');
		expect(pill).not.toBeNull();
		expect(pill.querySelector('button').getAttribute('aria-label')).toBe(
			'Dismiss',
		);
	});
});

// Core-block registration
// guard against version skew. ensureRegistered must register core
// blocks whenever a type QE's canvas edits is missing — not only when the
// registry is empty. A second plugin that loaded @wordpress/blocks and
// registered its own block leaves getBlockTypes().length > 0 while core/* is
// still absent; the old `length === 0` gate skipped registration and QE then
// parsed/serialized against a registry with no core/paragraph. When core blocks
// can't be made available the editor degrades to the load-error path instead of
// silently round-tripping through a foreign runtime.
describe('BlockTextEditor — core-block registration guard', () => {
	const getRegisterCoreBlocks = () =>
		require('@wordpress/block-library').registerCoreBlocks;

	const stubRegistry = (registered = []) => {
		const set = new Set(registered);
		window.wp = {
			blocks: {
				getBlockType: (name) => (set.has(name) ? { name } : undefined),
				getBlockTypes: () => [...set].map((name) => ({ name })),
			},
		};
	};

	afterEach(() => {
		delete window.wp;
	});

	it('registers core blocks when a foreign block is present but core/* is missing', () => {
		stubRegistry(['my/foreign-block']);
		const { ensureRegistered } = importComponent();
		ensureRegistered();
		expect(getRegisterCoreBlocks()).toHaveBeenCalled();
	});

	it('does not re-register when the blocks QE edits are already present', () => {
		stubRegistry(['core/paragraph', 'core/heading', 'core/button']);
		const { ensureRegistered } = importComponent();
		ensureRegistered();
		expect(getRegisterCoreBlocks()).not.toHaveBeenCalled();
	});

	it('reports unavailable (degrade signal) when repair cannot register core blocks', () => {
		// registerCoreBlocks is a no-op mock → core/* stays unregistered.
		stubRegistry(['my/foreign-block']);
		const { ensureRegistered } = importComponent();
		expect(ensureRegistered()).toBe(false);
	});

	it('degrades to the load-error pill instead of editing against a foreign runtime', async () => {
		stubRegistry(['my/foreign-block']);
		const { BlockTextEditor } = importComponent();
		const { findByText } = render(<BlockTextEditor selected={selected} />);
		await findByText(/Sorry, something went wrong/i);
		expect(mockGetBlockSource).not.toHaveBeenCalled();
		expect(
			document.querySelector('[data-testid="block-editor-provider"]'),
		).toBeNull();
	});
});

// Restrict the QE text
// toolbar to core formats (field report: third-party format bleed-through).
// <BlockToolbar> auto-renders a button for every registered rich-text format,
// so a plugin that calls registerFormatType (e.g. Spectra's `zipai/chat`
// "AI Assistant") leaks its button into our bar between alignment and bold.
// pruneForeignFormats drops every non-core format from the shared registry;
// core stays (bold/italic/link show, the rest sit in the CSS-hidden "More"
// overflow, and core/text-color must remain for our ColorButton to
// serialize). Verified live that core/unknown preserves dropped-format markup
// on round-trip, so this can't corrupt a save.
describe('BlockTextEditor — foreign-format toolbar curation', () => {
	// Stub the runtime rich-text registry the prune reads (wp.data store) and
	// mutates (wp.richText.unregisterFormatType). getFormatTypes lives on the
	// data store in current WP, not on wp.richText — mirror that here.
	const stubFormatRegistry = (names) => {
		const set = new Set(names);
		const unregistered = [];
		window.wp = {
			...(window.wp || {}),
			richText: {
				unregisterFormatType: (name) => {
					set.delete(name);
					unregistered.push(name);
				},
			},
			data: {
				select: (store) =>
					store === 'core/rich-text'
						? { getFormatTypes: () => [...set].map((name) => ({ name })) }
						: null,
			},
		};
		return { unregistered, remaining: () => [...set] };
	};

	afterEach(() => {
		delete window.wp;
	});

	it('drops a third-party format (Spectra zipai/chat) and keeps core formats', () => {
		const reg = stubFormatRegistry([
			'core/bold',
			'core/italic',
			'core/link',
			'core/text-color',
			'zipai/chat',
		]);
		const { pruneForeignFormats } = importComponent();
		pruneForeignFormats();
		expect(reg.unregistered).toEqual(['zipai/chat']);
		expect(reg.remaining()).toEqual(
			expect.arrayContaining([
				'core/bold',
				'core/italic',
				'core/link',
				'core/text-color',
			]),
		);
		expect(reg.remaining()).not.toContain('zipai/chat');
	});

	it('keeps core/text-color registered (our ColorButton serializes through it)', () => {
		const reg = stubFormatRegistry(['core/text-color', 'acme/fancy']);
		const { pruneForeignFormats } = importComponent();
		pruneForeignFormats();
		expect(reg.remaining()).toContain('core/text-color');
		expect(reg.remaining()).not.toContain('acme/fancy');
	});

	it('is idempotent — a second run finds nothing left to drop', () => {
		const reg = stubFormatRegistry(['core/bold', 'zipai/chat']);
		const { pruneForeignFormats } = importComponent();
		pruneForeignFormats();
		pruneForeignFormats();
		expect(reg.unregistered).toEqual(['zipai/chat']);
	});

	it('no-ops when the rich-text registry is unavailable (no window.wp)', () => {
		delete window.wp;
		const { pruneForeignFormats } = importComponent();
		expect(() => pruneForeignFormats()).not.toThrow();
	});
});
