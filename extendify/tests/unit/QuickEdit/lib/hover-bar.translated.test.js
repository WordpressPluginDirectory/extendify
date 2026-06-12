// The hover bar's translated-content guard. On a non-default-language render,
// clicking the Quick Edit pill on a text block must (a) show the error right
// under the bar — not a top-right pill the Agent sidebar would hide — and
// (b) never commit a selection (which renders nothing and, worse, the
// unsubSelected cancel-on-clear logic would tear down a co-staged Ask AI
// block). The bar (and its Ask AI pill) stays put.

const mockSetSelected = jest.fn();
const mockSetCommittedSelection = jest.fn();
let mockStoreState;

jest.mock('@quick-edit/state/edit-mode', () => ({
	useEditModeStore: {
		getState: () => ({ on: true }),
		subscribe: () => () => {},
	},
}));
jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: {
		getState: () => mockStoreState,
		subscribe: () => () => {},
		setState: () => {},
	},
}));
jest.mock('@quick-edit/lib/dom', () => ({
	resolveTarget: (el) => ({
		el,
		blockType: el?.dataset?.blockType || 'core/heading',
		blockId: 1,
		source: { kind: 'post', id: 1 },
	}),
}));
jest.mock('@quick-edit/lib/quick-edit-handlers', () => ({
	hasQuickEditModalFor: () => true,
}));
jest.mock('@quick-edit/lib/ask-ai', () => ({
	isAgentAvailable: () => false,
	isAgentSidebarOpen: () => false,
	hasAgentBlockSelected: () => false,
	askAiAboutElement: jest.fn(),
	stageAgentBlock: jest.fn(),
	subscribeToAgentBlock: () => () => {},
}));
jest.mock('@quick-edit/lib/agent-gate', () => ({
	isAgentEligibleForTarget: () => false,
}));
jest.mock('@quick-edit/lib/block-source-cache', () => ({
	prefetchBlockSource: jest.fn(),
}));
jest.mock('@quick-edit/lib/click-rule', () => ({
	decideClickAction: () => ({ action: 'ignore' }),
}));
jest.mock('@quick-edit/lib/insights', () => ({ track: jest.fn() }));
jest.mock('@quick-edit/lib/save-bridge', () => ({
	hasSaver: () => false,
	saveSelected: jest.fn(),
}));

const importBar = () => require('@quick-edit/lib/hover-bar');

const setTranslated = (isTranslated) => {
	window.extQuickEditData = {
		quickEditEnabled: true,
		translatedContext: isTranslated
			? { isTranslated: true, plugin: 'translatepress' }
			: { isTranslated: false, plugin: null },
	};
};

const heading = () => {
	const el = document.createElement('h2');
	el.setAttribute('data-extendify-agent-block-id', '1');
	el.getBoundingClientRect = () => ({
		top: 100,
		bottom: 140,
		left: 50,
		right: 250,
		width: 200,
		height: 40,
	});
	document.body.appendChild(el);
	return el;
};

const qerPill = () =>
	document.querySelector(
		'.extendify-quick-edit-bar [data-extendify-quick-edit-pill]',
	);

beforeEach(() => {
	jest.useFakeTimers();
	jest.resetModules();
	jest.clearAllMocks();
	document.body.innerHTML = '';
	mockStoreState = {
		selected: null,
		committedSelection: null,
		agentBlock: null,
		setSelected: mockSetSelected,
		setCommittedSelection: mockSetCommittedSelection,
		clearSelected: jest.fn(),
	};
});

afterEach(() => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	delete window.extQuickEditData;
});

describe('hover-bar — translated text guard', () => {
	it('Quick Edit pill on a translated text block shows the error under the bar and commits no selection', () => {
		setTranslated(true);
		const { showBar } = importBar();
		showBar(heading());

		const pill = qerPill();
		expect(pill).not.toBeNull();
		expect(pill.textContent).toContain('Quick Edit');

		pill.click();

		const alert = document.querySelector('[role="alert"]');
		expect(alert).not.toBeNull();
		expect(alert.textContent).toContain('TranslatePress');
		expect(mockSetSelected).not.toHaveBeenCalled();
		// The bar (and its Ask AI pill) stays mounted.
		expect(document.querySelector('.extendify-quick-edit-bar')).not.toBeNull();
	});

	it('editTarget (block-click / keyboard) commits no selection for translated text', () => {
		setTranslated(true);
		const { editTarget } = importBar();
		editTarget({
			el: heading(),
			blockType: 'core/heading',
			blockId: 1,
			source: { kind: 'post', id: 1 },
		});
		expect(mockSetSelected).not.toHaveBeenCalled();
	});

	it('on the default language the Quick Edit pill still commits a selection (no error)', () => {
		setTranslated(false);
		const { showBar } = importBar();
		showBar(heading());

		qerPill().click();

		expect(mockSetSelected).toHaveBeenCalledTimes(1);
		expect(document.querySelector('[role="alert"]')).toBeNull();
	});
});
