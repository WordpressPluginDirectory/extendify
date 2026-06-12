import { isAgentEligibleForTarget } from '@quick-edit/lib/agent-gate';

const TAGGED_SEL =
	'[data-extendify-agent-block-id], [data-extendify-part-block-id], .wp-block-navigation';

const makeTarget = (el, source = { kind: 'post', id: 1 }) => ({
	el,
	blockType: 'core/group',
	source,
});

const makeEl = ({ classes = [], innerTagged = 0 } = {}) => {
	const el = document.createElement('div');
	for (const c of classes) el.classList.add(c);
	for (let i = 0; i < innerTagged; i++) {
		const child = document.createElement('div');
		child.setAttribute('data-extendify-agent-block-id', String(i + 1));
		el.appendChild(child);
	}
	return el;
};

describe('isAgentEligibleForTarget', () => {
	it('rejects spacer / video / post-* targets so Ask AI does not surface', () => {
		expect(
			isAgentEligibleForTarget(
				makeTarget(makeEl({ classes: ['wp-block-spacer'] })),
			),
		).toBe(false);
		expect(
			isAgentEligibleForTarget(
				makeTarget(makeEl({ classes: ['wp-block-video'] })),
			),
		).toBe(false);
		expect(
			isAgentEligibleForTarget(
				makeTarget(makeEl({ classes: ['wp-block-post-title'] })),
			),
		).toBe(false);
		expect(
			isAgentEligibleForTarget(
				makeTarget(makeEl({ classes: ['wp-block-post-author'] })),
			),
		).toBe(false);
	});

	it('rejects targets with more than 50 tagged inner blocks', () => {
		const el = makeEl({ innerTagged: 51 });
		expect(el.querySelectorAll(TAGGED_SEL).length).toBe(51);
		expect(isAgentEligibleForTarget(makeTarget(el))).toBe(false);
	});

	it('accepts a normal tagged paragraph', () => {
		const p = makeEl({ classes: ['wp-block-paragraph'] });
		expect(isAgentEligibleForTarget(makeTarget(p))).toBe(true);
	});

	it('accepts a tagged container with exactly 50 tagged inner blocks', () => {
		const el = makeEl({ innerTagged: 50 });
		expect(isAgentEligibleForTarget(makeTarget(el))).toBe(true);
	});
});

// Drives showBar through real DOM fixtures to pin the new pill-render
// contract: selection lands on the innermost tagged ancestor regardless
// of its class (no more "promote a recognized child" preference), and
// the Quick Edit pill only renders when the resolved blockType has a
// modal handler. With window.extAgentData set the Ask AI pill renders
// alongside; without it, Ask-AI-only blocks render no bar at all.
jest.mock('@quick-edit/lib/insights', () => ({ track: jest.fn() }));
jest.mock('@quick-edit/lib/block-source-cache', () => ({
	prefetchBlockSource: jest.fn(),
	getBlockSource: jest.fn(),
	invalidateBlockSource: jest.fn(),
}));

const BAR_SEL = '.extendify-quick-edit-bar';
const QE_PILL_SEL =
	'.extendify-quick-edit-pill:not(.extendify-quick-edit-pill-ai)';
const AI_PILL_SEL = '.extendify-quick-edit-pill-ai';

const tagged = (el, blockId) => {
	el.setAttribute('data-extendify-agent-block-id', String(blockId));
	return el;
};

const div = (classes = []) => {
	const el = document.createElement('div');
	for (const c of classes) el.classList.add(c);
	return el;
};

const tag = (tagName, classes = []) => {
	const el = document.createElement(tagName);
	for (const c of classes) el.classList.add(c);
	return el;
};

describe('hover bar: pill rendering by resolved blockType', () => {
	let showBar;
	let useQuickEditStore;

	beforeEach(() => {
		jest.resetModules();
		document.body.innerHTML = '';
		delete window.extAgentData;
		// QE enabled is the precondition these behavior tests assume; the
		// showQuickEdit gate is exercised in its own describe below.
		window.extQuickEditData = { quickEditEnabled: true };
		({ showBar } = require('@quick-edit/lib/hover-bar'));
		({ useQuickEditStore } = require('@quick-edit/state/store'));
		useQuickEditStore.getState().clearSelected();
	});

	afterEach(() => {
		document.body.innerHTML = '';
		useQuickEditStore.getState().clearSelected();
	});

	const clickQuickEdit = () => {
		const pill = document.querySelector(QE_PILL_SEL);
		if (!pill) return null;
		pill.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		return useQuickEditStore.getState().selected;
	};

	// The Quick Edit pill is gated on the showQuickEdit partner
	// flag, surfaced to JS as window.extQuickEditData.quickEditEnabled.
	// When QE is off the QE pill never renders, but Ask AI is independent
	// and keeps surfacing (the agent's selector is unaffected).
	describe('Quick Edit gate (quickEditEnabled)', () => {
		const paragraphTarget = (el) => ({
			el,
			blockType: 'core/paragraph',
			source: { kind: 'post', id: 1 },
		});

		it('quickEditEnabled false → quickEditable false, aiAvailable still true', () => {
			window.extAgentData = {};
			window.extQuickEditData = { quickEditEnabled: false };
			const { pillContextFor } = require('@quick-edit/lib/hover-bar');

			const { quickEditable, aiAvailable } = pillContextFor(
				paragraphTarget(tag('p', ['wp-block-paragraph'])),
			);

			expect(quickEditable).toBe(false);
			expect(aiAvailable).toBe(true);
		});

		it('quickEditEnabled true → quickEditable true for a modal-backed block', () => {
			window.extQuickEditData = { quickEditEnabled: true };
			const { pillContextFor } = require('@quick-edit/lib/hover-bar');

			expect(
				pillContextFor(paragraphTarget(tag('p', ['wp-block-paragraph'])))
					.quickEditable,
			).toBe(true);
		});

		it('missing extQuickEditData → quickEditable false', () => {
			window.extAgentData = {};
			delete window.extQuickEditData;
			const { pillContextFor } = require('@quick-edit/lib/hover-bar');

			const { quickEditable, aiAvailable } = pillContextFor(
				paragraphTarget(tag('p', ['wp-block-paragraph'])),
			);

			expect(quickEditable).toBe(false);
			expect(aiAvailable).toBe(true);
		});

		it('QE off + no agent → showBar renders no bar at all on a paragraph', () => {
			window.extQuickEditData = { quickEditEnabled: false };
			const p = tagged(tag('p', ['wp-block-paragraph']), 5);
			document.body.appendChild(p);

			showBar(p);

			expect(document.querySelector(QE_PILL_SEL)).toBeNull();
			expect(document.querySelector(BAR_SEL)).toBeNull();
		});

		it('QE off + agent available → showBar renders only the Ask AI pill', () => {
			window.extAgentData = {};
			window.extQuickEditData = { quickEditEnabled: false };
			const p = tagged(tag('p', ['wp-block-paragraph']), 5);
			document.body.appendChild(p);

			showBar(p);

			expect(document.querySelector(QE_PILL_SEL)).toBeNull();
			expect(document.querySelector(AI_PILL_SEL)).not.toBeNull();
		});
	});

	it('renders a Quick Edit pill on a tagged paragraph (paragraph has a modal handler)', () => {
		const p = tagged(tag('p', ['wp-block-paragraph']), 5);
		document.body.appendChild(p);

		showBar(p);

		expect(document.querySelector(BAR_SEL)).not.toBeNull();
		const selected = clickQuickEdit();
		expect(selected.el).toBe(p);
		expect(selected.blockType).toBe('core/paragraph');
		expect(selected.blockId).toBe(5);
	});

	it('renders a Quick Edit pill on a tagged heading', () => {
		const h = tagged(tag('h2', ['wp-block-heading']), 9);
		document.body.appendChild(h);

		showBar(h);

		const selected = clickQuickEdit();
		expect(selected.blockType).toBe('core/heading');
	});

	it('selection of a child resolves to the tagged ancestor (no recognition preference)', () => {
		// Hovering a cover inside a tagged group now selects the group —
		// the container is what's tagged. core/group has no QE handler, so
		// no Quick Edit pill renders. With Ask AI unavailable in this test,
		// the bar doesn't mount at all.
		const group = tagged(div(['wp-block-group']), 7);
		const cover = div(['wp-block-cover']);
		group.appendChild(cover);
		document.body.appendChild(group);

		showBar(cover);

		expect(document.querySelector(QE_PILL_SEL)).toBeNull();
		expect(document.querySelector(BAR_SEL)).toBeNull();
	});

	it('renders an Ask AI pill (no Quick Edit) on a tagged container when the agent is available', () => {
		window.extAgentData = {};
		const group = tagged(div(['wp-block-group']), 7);
		document.body.appendChild(group);

		showBar(group);

		expect(document.querySelector(BAR_SEL)).not.toBeNull();
		expect(document.querySelector(QE_PILL_SEL)).toBeNull();
		expect(document.querySelector(AI_PILL_SEL)).not.toBeNull();
	});

	it.each([
		'wp-block-media-text',
		'wp-block-columns',
		'wp-block-gallery',
		'wp-block-quote',
		'wp-block-list',
		'wp-block-table',
		'wp-block-buttons',
	])('renders Ask AI but no Quick Edit on tagged %s', (cls) => {
		window.extAgentData = {};
		const el = tagged(div([cls]), 4);
		document.body.appendChild(el);

		showBar(el);

		expect(document.querySelector(BAR_SEL)).not.toBeNull();
		expect(document.querySelector(QE_PILL_SEL)).toBeNull();
		expect(document.querySelector(AI_PILL_SEL)).not.toBeNull();
	});

	// Soft-selection contract — see hover-bar.js onMouseOver + onDocClickCapture.
	// When a block is staged for Ask AI, hovers on OTHER blocks are
	// suppressed; the staged block itself still renders the bar; clicks
	// outside clear the staged block without touching the sidebar.
	describe('soft selection while an agent block is staged', () => {
		const mockSetOpen = jest.fn();

		beforeEach(() => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ setOpen: mockSetOpen }),
					subscribe: () => () => {},
				},
			}));
		});

		afterEach(() => {
			jest.dontMock('@agent/state/global');
			delete window.extAgentData;
			mockSetOpen.mockReset();
		});

		it('outside-click clears agentBlock but does NOT close the sidebar', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(staged);

			const outside = document.createElement('div');
			document.body.appendChild(outside);

			storeForThisRun.setState({
				agentBlock: {
					id: 'b-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();

			outside.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

			expect(storeForThisRun.getState().agentBlock).toBeNull();
			expect(mockSetOpen).not.toHaveBeenCalled();

			hoverBar.detach();
		});

		it('click inside the staged block does NOT clear it', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			const child = document.createElement('span');
			staged.appendChild(child);
			document.body.appendChild(staged);

			storeForThisRun.setState({
				agentBlock: {
					id: 'b-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();

			child.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

			expect(storeForThisRun.getState().agentBlock).not.toBeNull();

			hoverBar.detach();
		});

		it('click inside an open wp.media modal does NOT clear the staged block', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(staged);

			// The Agent's "Change image" picker opens a wp.media modal. Clicking
			// an image inside it must not read as an outside-click — that would
			// clear the staged block, cancel the in-flight workflow, and orphan
			// the modal as a stuck white overlay.
			const modal = tag('div', ['media-modal']);
			const attachment = document.createElement('button');
			modal.appendChild(attachment);
			document.body.appendChild(modal);

			storeForThisRun.setState({
				agentBlock: { id: 'b-1', target: 'data-extendify-agent-block-id' },
				agentBlockCode: null,
			});

			hoverBar.attach();

			attachment.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

			expect(storeForThisRun.getState().agentBlock).not.toBeNull();

			hoverBar.detach();
		});

		it('hovering ANOTHER tagged block while staged does not render the bar', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			const other = tagged(tag('p', ['wp-block-paragraph']), 'b-2');
			document.body.append(staged, other);

			storeForThisRun.setState({
				agentBlock: {
					id: 'b-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();

			other.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

			expect(document.querySelector(BAR_SEL)).toBeNull();

			hoverBar.detach();
		});

		it('hovering the staged block itself does NOT render the bar (no pills while staged)', () => {
			// Per the updated contract: while agentBlock is staged, the
			// hover bar is intentionally hidden — only DOMHighlighter's
			// X-close shows. To re-engage Ask AI, the user clicks X-close
			// (clearing agentBlock) and re-hovers.
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(staged);

			storeForThisRun.setState({
				agentBlock: {
					id: 'b-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();

			staged.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

			expect(document.querySelector(BAR_SEL)).toBeNull();

			hoverBar.detach();
		});

		// Clicking a DIFFERENT tagged block while
		// agent is staged transitions both surfaces in the same gesture:
		// clear the old stage and run the standard click table against
		// the new block. For a two-pill block with the sidebar open
		// that opens QE on the new block AND re-stages agentBlock.
		// Outside-clicks on whitespace still clear without falling
		// through (no new selection is created from empty space).
		it('clicking a different tagged block (two-pill) with agent open transitions selected + agentBlock', async () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: true, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			const other = tagged(tag('p', ['wp-block-paragraph']), 'b-2');
			document.body.append(staged, other);

			storeForThisRun.setState({
				agentBlock: {
					id: 'b-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();
			await new Promise((resolve) => setTimeout(resolve, 0));

			other.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

			expect(storeForThisRun.getState().selected).not.toBeNull();
			expect(storeForThisRun.getState().selected.el).toBe(other);
			expect(storeForThisRun.getState().agentBlock).not.toBeNull();
			expect(storeForThisRun.getState().agentBlock.id).toBe('b-2');

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		it('clicking a different Ask-AI-only tagged block with agent open transitions agentBlock', async () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: true, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(div(['wp-block-group']), 'g-1');
			const other = tagged(div(['wp-block-group']), 'g-2');
			document.body.append(staged, other);

			storeForThisRun.setState({
				agentBlock: {
					id: 'g-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();
			await new Promise((resolve) => setTimeout(resolve, 0));

			other.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

			expect(storeForThisRun.getState().agentBlock).not.toBeNull();
			expect(storeForThisRun.getState().agentBlock.id).toBe('g-2');
			expect(storeForThisRun.getState().selected).toBeNull();

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		it('clicking a tagged descendant inside the staged block re-stages on the descendant', async () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: true, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(div(['wp-block-group']), 'g-1');
			const inner = tagged(div(['wp-block-group']), 'g-2');
			staged.appendChild(inner);
			document.body.appendChild(staged);

			storeForThisRun.setState({
				agentBlock: {
					id: 'g-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();
			await new Promise((resolve) => setTimeout(resolve, 0));

			inner.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

			expect(storeForThisRun.getState().agentBlock).not.toBeNull();
			expect(storeForThisRun.getState().agentBlock.id).toBe('g-2');

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		it('clicking whitespace while staged clears agentBlock and does NOT commit a new selection', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const {
				useQuickEditStore: storeForThisRun,
			} = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const staged = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			const outside = document.createElement('div');
			document.body.append(staged, outside);

			storeForThisRun.setState({
				agentBlock: {
					id: 'b-1',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			hoverBar.attach();

			outside.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

			expect(storeForThisRun.getState().agentBlock).toBeNull();
			expect(storeForThisRun.getState().selected).toBeNull();
			expect(document.querySelector(BAR_SEL)).toBeNull();

			hoverBar.detach();
		});
	});

	// Click-to-commit contract — see hover-bar.js onDocClickCapture +
	// onMouseOver. A click on a tagged block pins the bar/outline to it;
	// hover on other tagged blocks is suppressed; a click on a different
	// tagged block commits the new one in the same gesture (single-click
	// swap); a click outside any tagged block clears the commit.
	//
	// Commit survives only for Ask-AI-only blocks
	// with the agent sidebar closed. Two-pill (QE + Ask AI) and QE-only
	// blocks open QE directly on click — see the Option 7 click table
	// describe block below. These tests use core/group fixtures, which
	// have no QE modal handler and become Ask-AI-only when extAgentData is
	// set; the dynamic import for @agent/state/global resolves to its
	// initial open=false state in the click rule's sidebar cache.
	describe('click-to-commit', () => {
		const dispatchClick = (el) => {
			el.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		};

		const setEditModeOn = () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });
			return { hoverBar, store };
		};

		beforeEach(() => {
			window.extAgentData = {};
		});

		afterEach(() => {
			document.body.innerHTML = '';
			delete window.extAgentData;
		});

		it('clicking an Ask-AI-only tagged block sets committedSelection and renders the bar', () => {
			const { hoverBar, store } = setEditModeOn();
			const g = tagged(div(['wp-block-group']), 5);
			document.body.appendChild(g);
			hoverBar.attach();

			dispatchClick(g);

			expect(document.querySelector(BAR_SEL)).not.toBeNull();
			expect(store.getState().committedSelection).not.toBeNull();
			expect(store.getState().committedSelection.el).toBe(g);

			hoverBar.detach();
		});

		it('while committed, hovering a different tagged block does NOT re-render the bar', () => {
			const { hoverBar, store } = setEditModeOn();
			const a = tagged(div(['wp-block-group']), 1);
			const b = tagged(div(['wp-block-group']), 2);
			document.body.append(a, b);
			hoverBar.attach();

			dispatchClick(a);
			const barAfterClick = document.querySelector(BAR_SEL);
			expect(barAfterClick).not.toBeNull();

			b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

			expect(document.querySelector(BAR_SEL)).toBe(barAfterClick);
			expect(store.getState().committedSelection.el).toBe(a);

			hoverBar.detach();
		});

		it('hovering the committed block itself is idempotent (no tear-down + re-render)', () => {
			const { hoverBar } = setEditModeOn();
			const g = tagged(div(['wp-block-group']), 7);
			document.body.appendChild(g);
			hoverBar.attach();

			dispatchClick(g);
			const barAfterClick = document.querySelector(BAR_SEL);

			g.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

			expect(document.querySelector(BAR_SEL)).toBe(barAfterClick);

			hoverBar.detach();
		});

		it('hovering a tagged inner child of a committed group does NOT move the bar', () => {
			const { hoverBar, store } = setEditModeOn();
			const group = tagged(div(['wp-block-group']), 100);
			const inner = tagged(tag('p', ['wp-block-paragraph']), 101);
			group.appendChild(inner);
			document.body.appendChild(group);
			hoverBar.attach();

			dispatchClick(group);
			const barAfterClick = document.querySelector(BAR_SEL);
			expect(store.getState().committedSelection.el).toBe(group);

			inner.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

			expect(document.querySelector(BAR_SEL)).toBe(barAfterClick);
			expect(store.getState().committedSelection.el).toBe(group);

			hoverBar.detach();
		});

		it('Esc clears committedSelection and removes the bar', () => {
			const { hoverBar, store } = setEditModeOn();
			const { wireGlobalEscape } = require('@quick-edit/lib/global-escape');
			const g = tagged(div(['wp-block-group']), 200);
			document.body.appendChild(g);
			hoverBar.attach();
			const unwireEsc = wireGlobalEscape();

			dispatchClick(g);
			expect(store.getState().committedSelection).not.toBeNull();
			expect(document.querySelector(BAR_SEL)).not.toBeNull();

			document.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				}),
			);

			expect(store.getState().committedSelection).toBeNull();
			expect(document.querySelector(BAR_SEL)).toBeNull();

			unwireEsc();
			hoverBar.detach();
		});

		it('clicking outside any tagged block clears committedSelection and the bar', () => {
			const { hoverBar, store } = setEditModeOn();
			const g = tagged(div(['wp-block-group']), 9);
			const outside = document.createElement('div');
			document.body.append(g, outside);
			hoverBar.attach();

			dispatchClick(g);
			expect(store.getState().committedSelection).not.toBeNull();

			dispatchClick(outside);

			expect(store.getState().committedSelection).toBeNull();
			expect(document.querySelector(BAR_SEL)).toBeNull();

			hoverBar.detach();
		});

		it('clicking a DIFFERENT tagged block while committed commits the new one in one gesture', () => {
			const { hoverBar, store } = setEditModeOn();
			const a = tagged(div(['wp-block-group']), 11);
			const b = tagged(div(['wp-block-group']), 22);
			document.body.append(a, b);
			hoverBar.attach();

			dispatchClick(a);
			expect(store.getState().committedSelection.el).toBe(a);

			dispatchClick(b);

			expect(store.getState().committedSelection.el).toBe(b);
			expect(document.querySelector(BAR_SEL)).not.toBeNull();

			hoverBar.detach();
		});

		it('clicking a tagged descendant of the committed block swaps the commit to the descendant', () => {
			const { hoverBar, store } = setEditModeOn();
			const group = tagged(div(['wp-block-group']), 44);
			const inner = tagged(div(['wp-block-group']), 55);
			group.appendChild(inner);
			document.body.appendChild(group);
			hoverBar.attach();

			dispatchClick(group);
			expect(store.getState().committedSelection.el).toBe(group);

			dispatchClick(inner);

			expect(store.getState().committedSelection.el).toBe(inner);

			hoverBar.detach();
		});

		it('clicking the SAME committed block again is a no-op', () => {
			const { hoverBar, store } = setEditModeOn();
			const g = tagged(div(['wp-block-group']), 33);
			document.body.appendChild(g);
			hoverBar.attach();

			dispatchClick(g);
			const barAfterFirst = document.querySelector(BAR_SEL);
			const committedAfterFirst = store.getState().committedSelection;

			dispatchClick(g);

			expect(document.querySelector(BAR_SEL)).toBe(barAfterFirst);
			expect(store.getState().committedSelection).toBe(committedAfterFirst);

			hoverBar.detach();
		});

		it('clicking the Ask AI pill clears committedSelection', () => {
			const mockSetOpen = jest.fn();
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ setOpen: mockSetOpen }),
					subscribe: () => () => {},
				},
			}));

			const { hoverBar, store } = setEditModeOn();
			const g = tagged(div(['wp-block-group']), 55);
			document.body.appendChild(g);
			hoverBar.attach();

			dispatchClick(g);
			expect(store.getState().committedSelection).not.toBeNull();

			const pill = document.querySelector(AI_PILL_SEL);
			expect(pill).not.toBeNull();
			dispatchClick(pill);

			expect(store.getState().committedSelection).toBeNull();

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});
	});

	// Click semantics by pill-count + agent
	// sidebar state. The committed-selection cell narrows to Ask-AI-only +
	// agent closed; QE-only collapses to direct open; Ask-AI-only + agent
	// open silently stages the agent's block.
	describe('Option 7 click table', () => {
		const dispatchClick = (el) => {
			el.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		};

		const setEditModeOn = () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });
			return { hoverBar, store };
		};

		afterEach(() => {
			document.body.innerHTML = '';
			delete window.extAgentData;
		});

		it('QE-only block: click opens QE directly without setting committedSelection', () => {
			// No extAgentData → paragraph is QE-only.
			const { hoverBar, store } = setEditModeOn();
			const p = tagged(tag('p', ['wp-block-paragraph']), 100);
			document.body.appendChild(p);
			hoverBar.attach();

			dispatchClick(p);

			expect(store.getState().selected).not.toBeNull();
			expect(store.getState().selected.el).toBe(p);
			expect(store.getState().committedSelection).toBeNull();

			hoverBar.detach();
		});

		it('Ask-AI-only + agent closed: click commits (surviving sticky case)', () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: false, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			const { hoverBar, store } = setEditModeOn();
			const group = tagged(div(['wp-block-group']), 200);
			document.body.appendChild(group);
			hoverBar.attach();

			dispatchClick(group);

			expect(store.getState().committedSelection).not.toBeNull();
			expect(store.getState().committedSelection.el).toBe(group);
			expect(document.querySelector(BAR_SEL)).not.toBeNull();
			expect(store.getState().agentBlock).toBeNull();

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		it('Ask-AI-only + agent open: click silently stages agentBlock (no commit, no bar)', async () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: true, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			const { hoverBar, store } = setEditModeOn();
			const group = tagged(div(['wp-block-group']), 300);
			document.body.appendChild(group);
			// Sidebar is open → the chat textarea is already mounted; the
			// silent stage drops the cursor into it.
			const textarea = document.createElement('textarea');
			textarea.id = 'extendify-agent-chat-textarea';
			const focusSpy = jest.spyOn(textarea, 'focus');
			document.body.appendChild(textarea);
			hoverBar.attach();
			// Let the sidebar-state watcher's dynamic import resolve so the
			// click rule sees agentOpen=true on the next sync click.
			await new Promise((resolve) => setTimeout(resolve, 0));

			dispatchClick(group);

			expect(store.getState().agentBlock).not.toBeNull();
			expect(store.getState().agentBlock.id).toBe('300');
			expect(store.getState().committedSelection).toBeNull();
			expect(document.querySelector(BAR_SEL)).toBeNull();
			expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		// Two-pill (QE + Ask AI) blocks collapse the click to
		// "open QE directly" everywhere, with a silent agent-bridge when
		// the sidebar is open. The Ask AI pill now lives on the QE chrome
		// (BlockTextEditor's floating-bar-actions), so the user can still
		// escalate to the agent from inside the editor.
		it('two-pill + agent closed: click opens QE directly, does NOT commit, does NOT stage agentBlock', () => {
			window.extAgentData = {};
			const { hoverBar, store } = setEditModeOn();
			const p = tagged(tag('p', ['wp-block-paragraph']), 400);
			document.body.appendChild(p);
			hoverBar.attach();

			dispatchClick(p);

			expect(store.getState().selected).not.toBeNull();
			expect(store.getState().selected.el).toBe(p);
			expect(store.getState().committedSelection).toBeNull();
			expect(store.getState().agentBlock).toBeNull();

			hoverBar.detach();
		});

		it('two-pill + agent open: click opens QE AND silently stages agentBlock', async () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: true, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			const { hoverBar, store } = setEditModeOn();
			const p = tagged(tag('p', ['wp-block-paragraph']), 500);
			document.body.appendChild(p);
			const textarea = document.createElement('textarea');
			textarea.id = 'extendify-agent-chat-textarea';
			const focusSpy = jest.spyOn(textarea, 'focus');
			document.body.appendChild(textarea);
			hoverBar.attach();
			await new Promise((resolve) => setTimeout(resolve, 0));

			dispatchClick(p);

			expect(store.getState().selected).not.toBeNull();
			expect(store.getState().selected.el).toBe(p);
			expect(store.getState().agentBlock).not.toBeNull();
			expect(store.getState().agentBlock.id).toBe('500');
			expect(store.getState().committedSelection).toBeNull();
			expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		// Clicking a picker block after a non-picker
		// block was selected used to lose the hover bar that renderBar
		// just mounted. `onEditClick` calls `setCommittedSelection(null)`
		// before `setSelected({...image})`, and the broad unsubSelected
		// subscriber fired on the first write while state.selected was
		// still the prior text block, hit the non-picker clearBar branch,
		// and tore the bar down. The picker mounted via React with no
		// pills, no outline — see missing-pills-after-text.spec.ts. Gate
		// on actual `selected` change to keep the bar alive.
		it('non-picker → picker click: hover bar survives the transition', () => {
			window.extAgentData = {};
			const { hoverBar, store } = setEditModeOn();
			const paragraph = tagged(tag('p', ['wp-block-paragraph']), 700);
			const figure = tagged(tag('figure', ['wp-block-image']), 701);
			document.body.appendChild(paragraph);
			document.body.appendChild(figure);
			hoverBar.attach();

			dispatchClick(paragraph);
			expect(store.getState().selected?.el).toBe(paragraph);
			expect(document.querySelector(BAR_SEL)).toBeNull();

			dispatchClick(figure);

			expect(store.getState().selected?.el).toBe(figure);
			expect(store.getState().selected?.blockType).toBe('core/image');
			expect(document.querySelector(BAR_SEL)).not.toBeNull();

			hoverBar.detach();
		});

		// Picker-type two-pill blocks (image, cover)
		// are exempt from the silent agent stage. The bar stays mounted
		// for picker types and keeps the Ask AI pill, so the user can
		// still escalate by clicking it. Auto-staging here would surface
		// BOTH the QE picker dropdown AND the agent's DOMHighlighter
		// X-close on the same block.
		it('picker-type two-pill + agent open: click opens QE, does NOT stage agentBlock', async () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: true, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			const { hoverBar, store } = setEditModeOn();
			const figure = tagged(tag('figure', ['wp-block-image']), 600);
			document.body.appendChild(figure);
			hoverBar.attach();
			await new Promise((resolve) => setTimeout(resolve, 0));

			dispatchClick(figure);

			expect(store.getState().selected).not.toBeNull();
			expect(store.getState().selected.el).toBe(figure);
			expect(store.getState().selected.blockType).toBe('core/image');
			expect(store.getState().agentBlock).toBeNull();
			expect(store.getState().committedSelection).toBeNull();
			expect(document.querySelector(BAR_SEL)).not.toBeNull();

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		// Issue 19: the select branch's stopPropagation keeps ImagePicker's
		// bubble-phase outside-click from firing, so the branch itself must
		// drop a stale picker selection or the image menu lingers.
		it('picker selected → click an Ask-AI-only block (agent closed): clears selected, commits the new block', () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: false, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			const { hoverBar, store } = setEditModeOn();
			const figure = tagged(tag('figure', ['wp-block-image']), 800);
			const group = tagged(div(['wp-block-group']), 801);
			document.body.append(figure, group);
			hoverBar.attach();

			dispatchClick(figure);
			expect(store.getState().selected?.blockType).toBe('core/image');

			dispatchClick(group);

			expect(store.getState().selected).toBeNull();
			expect(store.getState().committedSelection?.el).toBe(group);

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		it('picker selected → click an Ask-AI-only block (agent open): clears selected, stages agentBlock', async () => {
			window.extAgentData = {};
			jest.doMock('@agent/state/global', () => ({
				useGlobalStore: {
					getState: () => ({ open: true, setOpen: jest.fn() }),
					subscribe: () => () => {},
				},
			}));

			const { hoverBar, store } = setEditModeOn();
			const figure = tagged(tag('figure', ['wp-block-image']), 810);
			const group = tagged(div(['wp-block-group']), 811);
			document.body.append(figure, group);
			hoverBar.attach();
			await new Promise((resolve) => setTimeout(resolve, 0));

			dispatchClick(figure);
			expect(store.getState().selected?.blockType).toBe('core/image');

			dispatchClick(group);

			expect(store.getState().selected).toBeNull();
			expect(store.getState().agentBlock?.id).toBe('811');

			hoverBar.detach();
			jest.dontMock('@agent/state/global');
		});

		// The stale-selection clear must not break the same-image toggle —
		// it only fires when the click lands on a different element.
		it('picker selected → click the same image again still toggles the selection off', () => {
			window.extAgentData = {};
			const { hoverBar, store } = setEditModeOn();
			const figure = tagged(tag('figure', ['wp-block-image']), 820);
			document.body.appendChild(figure);
			hoverBar.attach();

			dispatchClick(figure);
			expect(store.getState().selected?.blockType).toBe('core/image');

			dispatchClick(figure);

			expect(store.getState().selected).toBeNull();

			hoverBar.detach();
		});

		// A product:image is a picker type via
		// InlineEditor's PICKER_STRATEGIES (routes through ImagePicker
		// alongside core/image / core/cover) but was missing from
		// hover-bar's isPickerType set. Ask AI is ineligible for product
		// sources (source.kind === 'product'), so the click enters the
		// QE-only cell, then onEditClick fires clearBar before setSelected
		// because product:image didn't match isPickerType — picker dropdown
		// mounted via React with no hover bar anchoring it. Reproduces on
		// WooCommerce patterns.
		it('product:image QE-only click: hover bar survives (picker stays anchored)', () => {
			const { hoverBar, store } = setEditModeOn();
			const productImage = tag('img', ['wp-block-image']);
			productImage.setAttribute('data-extendify-quick-edit-product-id', '42');
			productImage.setAttribute(
				'data-extendify-quick-edit-product-field',
				'image',
			);
			document.body.appendChild(productImage);
			hoverBar.attach();

			dispatchClick(productImage);

			expect(store.getState().selected?.el).toBe(productImage);
			expect(store.getState().selected?.blockType).toBe('product:image');
			expect(document.querySelector(BAR_SEL)).not.toBeNull();

			hoverBar.detach();
		});

		// core/media-text keeps its image on a block attribute, so the media
		// <figure> is tagged directly (MediaTextTagger). A click on the image
		// resolves to the synthetic picker type core/media-text:image while
		// selection lands on the media-text wrapper (el), carrying the figure
		// as mediaEl and the real block name for SaveController. Picker type →
		// the bar stays anchored, same as core/image / product:image.
		it('media-text image click: resolves to core/media-text:image, bar stays anchored', () => {
			const { hoverBar, store } = setEditModeOn();
			const wrapper = tagged(div(['wp-block-media-text']), 50);
			const figure = tag('figure', ['wp-block-media-text__media']);
			figure.setAttribute('data-extendify-quick-edit-mediatext-media', '1');
			const image = tag('img');
			figure.appendChild(image);
			wrapper.appendChild(figure);
			document.body.appendChild(wrapper);
			hoverBar.attach();

			dispatchClick(image);

			const selected = store.getState().selected;
			expect(selected).not.toBeNull();
			expect(selected.el).toBe(wrapper);
			expect(selected.mediaEl).toBe(figure);
			expect(selected.blockType).toBe('core/media-text:image');
			expect(selected.blockName).toBe('core/media-text');
			expect(document.querySelector(BAR_SEL)).not.toBeNull();

			hoverBar.detach();
		});

		// The block element wraps both the image and the text column, but the
		// selector should hug just the image — anchor the outline to the
		// media <figure> (mediaEl), not the whole media-text block.
		it('media-text image: outline anchors to the figure, not the whole block', () => {
			const { hoverBar } = setEditModeOn();
			const wrapper = tagged(div(['wp-block-media-text']), 50);
			const figure = tag('figure', ['wp-block-media-text__media']);
			figure.setAttribute('data-extendify-quick-edit-mediatext-media', '1');
			const image = tag('img');
			figure.appendChild(image);
			wrapper.appendChild(figure);
			document.body.appendChild(wrapper);
			wrapper.getBoundingClientRect = () => ({
				top: 50,
				left: 50,
				width: 500,
				height: 300,
				bottom: 350,
				right: 550,
			});
			figure.getBoundingClientRect = () => ({
				top: 100,
				left: 200,
				width: 60,
				height: 40,
				bottom: 140,
				right: 260,
			});
			hoverBar.attach();

			dispatchClick(image);

			const outline = document.querySelector(
				'.extendify-quick-edit-hover-outline',
			);
			expect(outline).not.toBeNull();
			expect(outline.style.top).toBe('100px');
			expect(outline.style.left).toBe('200px');
			expect(outline.style.width).toBe('60px');
			expect(outline.style.height).toBe('40px');

			hoverBar.detach();
		});
	});

	// Implicit-close gestures (cross-block click,
	// whitespace click) save the in-flight QE edits instead of discarding
	// them. The bridge is a no-op when no canvas is open (no saver
	// registered) so picker-block flows + the rest of the click rule are
	// untouched.
	describe('implicit-close save bridge', () => {
		const dispatchClick = (el) => {
			el.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		};

		afterEach(() => {
			document.body.innerHTML = '';
			delete window.extAgentData;
		});

		it('cross-block click while QE is open saves A with alsoClear: false', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			const {
				registerSaver,
				unregisterSaver,
			} = require('@quick-edit/lib/save-bridge');
			useEditModeStore.setState({ on: true });

			const a = tagged(tag('p', ['wp-block-paragraph']), 'a');
			const b = tagged(tag('p', ['wp-block-paragraph']), 'b');
			document.body.appendChild(a);
			document.body.appendChild(b);

			const saver = jest.fn();
			registerSaver(saver);
			store.getState().setSelected({
				el: a,
				blockType: 'core/paragraph',
				blockId: 'a',
				source: { kind: 'post', id: 1 },
			});

			hoverBar.attach();
			dispatchClick(b);

			expect(saver).toHaveBeenCalledTimes(1);
			expect(saver).toHaveBeenCalledWith({ alsoClear: false });
			expect(store.getState().selected?.el).toBe(b);

			unregisterSaver(saver);
			hoverBar.detach();
		});

		it('whitespace click while QE is open saves with alsoClear: true', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			const {
				registerSaver,
				unregisterSaver,
			} = require('@quick-edit/lib/save-bridge');
			useEditModeStore.setState({ on: true });

			const a = tagged(tag('p', ['wp-block-paragraph']), 'a');
			const whitespace = document.createElement('div');
			document.body.appendChild(a);
			document.body.appendChild(whitespace);

			const saver = jest.fn();
			registerSaver(saver);
			store.getState().setSelected({
				el: a,
				blockType: 'core/paragraph',
				blockId: 'a',
				source: { kind: 'post', id: 1 },
			});

			hoverBar.attach();
			dispatchClick(whitespace);

			expect(saver).toHaveBeenCalledTimes(1);
			expect(saver).toHaveBeenCalledWith({ alsoClear: true });
			// selected stays — handleSave's own clearSelected is what
			// unmounts the canvas asynchronously on success.
			expect(store.getState().selected?.el).toBe(a);

			unregisterSaver(saver);
			hoverBar.detach();
		});

		// Tagged-but-no-QE-handler block (e.g. spacer). The user gesture
		// is "I'm done with this canvas" — save and close. Without this
		// carve-out, alsoClear: false would leave the canvas mounted on A
		// because the new tagged target opens nothing.
		it('clicking a tagged-but-not-QE block (spacer) saves with alsoClear: true', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			const {
				registerSaver,
				unregisterSaver,
			} = require('@quick-edit/lib/save-bridge');
			useEditModeStore.setState({ on: true });

			const a = tagged(tag('p', ['wp-block-paragraph']), 'a');
			const spacer = tagged(div(['wp-block-spacer']), 'spacer');
			document.body.appendChild(a);
			document.body.appendChild(spacer);

			const saver = jest.fn();
			registerSaver(saver);
			store.getState().setSelected({
				el: a,
				blockType: 'core/paragraph',
				blockId: 'a',
				source: { kind: 'post', id: 1 },
			});

			hoverBar.attach();
			dispatchClick(spacer);

			expect(saver).toHaveBeenCalledTimes(1);
			expect(saver).toHaveBeenCalledWith({ alsoClear: true });

			unregisterSaver(saver);
			hoverBar.detach();
		});

		it("no saver registered: cross-block click falls through to today's overwrite behavior", () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const a = tagged(tag('p', ['wp-block-paragraph']), 'a');
			const b = tagged(tag('p', ['wp-block-paragraph']), 'b');
			document.body.appendChild(a);
			document.body.appendChild(b);

			store.getState().setSelected({
				el: a,
				blockType: 'core/paragraph',
				blockId: 'a',
				source: { kind: 'post', id: 1 },
			});

			hoverBar.attach();
			dispatchClick(b);

			expect(store.getState().selected?.el).toBe(b);

			hoverBar.detach();
		});

		it("no saver + whitespace click: canvas stays open (today's behavior)", () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const a = tagged(tag('p', ['wp-block-paragraph']), 'a');
			const whitespace = document.createElement('div');
			document.body.appendChild(a);
			document.body.appendChild(whitespace);

			store.getState().setSelected({
				el: a,
				blockType: 'core/paragraph',
				blockId: 'a',
				source: { kind: 'post', id: 1 },
			});

			hoverBar.attach();
			dispatchClick(whitespace);

			expect(store.getState().selected?.el).toBe(a);

			hoverBar.detach();
		});
	});

	// Esc re-engagement — when `selected` transitions non-null
	// → null (canvas closes), the bar re-renders on the previously edited
	// element without waiting for a mouseover. The fix sidesteps the
	// mouseover-needs-element-boundary timing: same-block re-entry doesn't
	// fire mouseover, so without the force-render the bar stays gone
	// until the user nudges the cursor onto a different block.
	describe('selected → null re-renders the bar (Esc re-engagement)', () => {
		it('re-renders the bar on the previously edited element', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const p = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(p);

			hoverBar.attach();

			store.getState().setSelected({
				el: p,
				blockType: 'core/paragraph',
				blockId: 'b-1',
				source: { kind: 'post', id: 1 },
			});
			// Selected → bar cleared.
			expect(document.querySelector(BAR_SEL)).toBeNull();

			store.getState().setSelected(null);

			expect(document.querySelector(BAR_SEL)).not.toBeNull();

			hoverBar.detach();
		});

		it('does not re-render when transitioning null → null', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			hoverBar.attach();
			expect(document.querySelector(BAR_SEL)).toBeNull();

			// No prior selection — clearing again should not synthesize a bar.
			store.getState().setSelected(null);
			expect(document.querySelector(BAR_SEL)).toBeNull();

			hoverBar.detach();
		});

		it('does not re-render when the previous element has detached from the DOM', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const p = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(p);

			hoverBar.attach();

			store.getState().setSelected({
				el: p,
				blockType: 'core/paragraph',
				blockId: 'b-1',
				source: { kind: 'post', id: 1 },
			});

			// Mimic save: block is replaced (its DOM node detaches).
			p.remove();
			store.getState().setSelected(null);

			expect(document.querySelector(BAR_SEL)).toBeNull();

			hoverBar.detach();
		});

		it('does not re-render when edit mode is off', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const p = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(p);

			hoverBar.attach();
			store.getState().setSelected({
				el: p,
				blockType: 'core/paragraph',
				blockId: 'b-1',
				source: { kind: 'post', id: 1 },
			});

			useEditModeStore.setState({ on: false });
			store.getState().setSelected(null);

			expect(document.querySelector(BAR_SEL)).toBeNull();

			hoverBar.detach();
		});

		// Esc/Cancel/Save/programmatic
		// clearSelected on the same block the agent is staged on must also
		// clear the agent stage; otherwise the dashed outline + X-close
		// linger on a block the user dismissed.
		it('clears agentBlock when QE canvas closes on the same block', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const p = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(p);

			hoverBar.attach();
			store.setState({
				selected: {
					el: p,
					blockType: 'core/paragraph',
					blockId: 'b-1',
					source: { kind: 'post', id: 1 },
				},
				agentBlock: { id: 'b-1', target: 'data-extendify-agent-block-id' },
				agentBlockCode: null,
			});

			const cancelListener = jest.fn();
			window.addEventListener(
				'extendify-agent:cancel-workflow',
				cancelListener,
			);

			store.getState().setSelected(null);

			expect(store.getState().agentBlock).toBeNull();
			expect(cancelListener).toHaveBeenCalledTimes(1);

			window.removeEventListener(
				'extendify-agent:cancel-workflow',
				cancelListener,
			);
			hoverBar.detach();
		});

		// The cross-block weird-state: canvas on A but agent staged on B.
		// Closing the canvas should NOT touch agent B — it isn't the same
		// block the user just dismissed.
		it('leaves agentBlock alone when canvas closes on a DIFFERENT block', () => {
			jest.resetModules();
			const hoverBar = require('@quick-edit/lib/hover-bar');
			const { useQuickEditStore: store } = require('@quick-edit/state/store');
			const { useEditModeStore } = require('@quick-edit/state/edit-mode');
			useEditModeStore.setState({ on: true });

			const p = tagged(tag('p', ['wp-block-paragraph']), 'b-1');
			document.body.appendChild(p);

			hoverBar.attach();
			store.setState({
				selected: {
					el: p,
					blockType: 'core/paragraph',
					blockId: 'b-1',
					source: { kind: 'post', id: 1 },
				},
				agentBlock: {
					id: 'b-OTHER',
					target: 'data-extendify-agent-block-id',
				},
				agentBlockCode: null,
			});

			store.getState().setSelected(null);

			expect(store.getState().agentBlock?.id).toBe('b-OTHER');

			hoverBar.detach();
		});
	});

	// 0c0170da — buildTarget walks past a tagged ancestor with a null
	// blockType (KNOWN_UNSUPPORTED post-title) to the next tagged ancestor
	// (cover) so renderBar has something to offer.
	it('walks past a tagged unsupported ancestor (post-title) to the next editable tagged ancestor (cover)', () => {
		const cover = tagged(div(['wp-block-cover']), 11);
		const inner = div(['wp-block-cover__inner-container']);
		const postTitle = tagged(tag('h1', ['wp-block-post-title']), 12);
		inner.appendChild(postTitle);
		cover.appendChild(inner);
		document.body.appendChild(cover);

		showBar(postTitle);

		expect(document.querySelector(BAR_SEL)).not.toBeNull();
		const selected = clickQuickEdit();
		expect(selected.el).toBe(cover);
		expect(selected.blockType).toBe('core/cover');
		expect(selected.blockId).toBe(11);
	});
});
