// Global Esc wiring.
//
// `wireGlobalEscape` attaches one document-level keydown listener that
// runs the decideEscapeAction priority order, mutates the right store,
// and stops propagation so legacy window-level Esc listeners (the agent
// chat's, the old per-feature ones) don't fire stale logic alongside.
//
// Per-surface Esc handlers — BlockTextEditor's capture-phase listener,
// WP's <Modal>, the InlineEditor image-menu handler — fire on their own
// surfaces. The global handler is the fallback for "nothing local
// consumed Esc."

const mockQuickEditState = {
	agentBlock: null,
	selected: null,
	committedSelection: null,
};
const mockSetAgentBlock = jest.fn((agentBlock) => {
	mockQuickEditState.agentBlock = agentBlock;
});
const mockClearSelected = jest.fn(() => {
	mockQuickEditState.selected = null;
});
const mockSetCommittedSelection = jest.fn((committedSelection) => {
	mockQuickEditState.committedSelection = committedSelection;
});

jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: {
		getState: () => ({
			agentBlock: mockQuickEditState.agentBlock,
			selected: mockQuickEditState.selected,
			committedSelection: mockQuickEditState.committedSelection,
			setAgentBlock: mockSetAgentBlock,
			clearSelected: mockClearSelected,
			setCommittedSelection: mockSetCommittedSelection,
		}),
	},
}));

const mockEditModeState = { on: false };
jest.mock('@quick-edit/state/edit-mode', () => ({
	useEditModeStore: {
		getState: () => ({ on: mockEditModeState.on }),
	},
}));

const dispatchEsc = () => {
	const event = new KeyboardEvent('keydown', {
		key: 'Escape',
		bubbles: true,
		cancelable: true,
	});
	const stopSpy = jest.spyOn(event, 'stopPropagation');
	const preventSpy = jest.spyOn(event, 'preventDefault');
	document.dispatchEvent(event);
	return { event, stopSpy, preventSpy };
};

let unwire = () => {};

beforeEach(() => {
	jest.clearAllMocks();
	mockQuickEditState.agentBlock = null;
	mockQuickEditState.selected = null;
	mockQuickEditState.committedSelection = null;
	mockEditModeState.on = false;
});

afterEach(() => {
	unwire();
	unwire = () => {};
});

describe('wireGlobalEscape — edit mode off', () => {
	it('does nothing and does not stop propagation', async () => {
		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		const { stopSpy, preventSpy } = dispatchEsc();

		expect(mockSetAgentBlock).not.toHaveBeenCalled();
		expect(mockClearSelected).not.toHaveBeenCalled();
		expect(stopSpy).not.toHaveBeenCalled();
		expect(preventSpy).not.toHaveBeenCalled();
	});

	it('ignores non-Escape keys even when edit mode is on', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.agentBlock = { id: 'b-1' };
		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		});
		const stopSpy = jest.spyOn(event, 'stopPropagation');
		document.dispatchEvent(event);

		expect(mockSetAgentBlock).not.toHaveBeenCalled();
		expect(stopSpy).not.toHaveBeenCalled();
	});
});

describe('wireGlobalEscape — clears the agent block', () => {
	it('clears the agent block, dispatches cancel-workflow, and stops propagation', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.agentBlock = { id: 'b-1' };

		const cancelListener = jest.fn();
		window.addEventListener('extendify-agent:cancel-workflow', cancelListener);

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		const { stopSpy, preventSpy } = dispatchEsc();

		expect(mockSetAgentBlock).toHaveBeenCalledWith(null);
		expect(mockClearSelected).not.toHaveBeenCalled();
		expect(cancelListener).toHaveBeenCalledTimes(1);
		expect(stopSpy).toHaveBeenCalled();
		expect(preventSpy).toHaveBeenCalled();

		window.removeEventListener(
			'extendify-agent:cancel-workflow',
			cancelListener,
		);
	});

	it('prefers clearing the agent block when both agent block and QE selection are set on DIFFERENT blocks', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.agentBlock = { id: 'b-1' };
		mockQuickEditState.selected = { blockId: 's-1' };

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		dispatchEsc();

		expect(mockSetAgentBlock).toHaveBeenCalledWith(null);
		expect(mockClearSelected).not.toHaveBeenCalled();
	});

	// Two-pill click stages both `selected` and `agentBlock` on the same
	// block. A single Esc should unwind both — without this collapse the
	// user has to press Esc twice to fully exit the block.
	it('clears BOTH the agent block and QE selection in one keypress when they reference the same block', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.agentBlock = { id: '5' };
		mockQuickEditState.selected = { blockId: 5 };

		const cancelListener = jest.fn();
		window.addEventListener('extendify-agent:cancel-workflow', cancelListener);

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		const { stopSpy, preventSpy } = dispatchEsc();

		expect(mockSetAgentBlock).toHaveBeenCalledWith(null);
		expect(mockClearSelected).toHaveBeenCalledTimes(1);
		expect(cancelListener).toHaveBeenCalledTimes(1);
		expect(stopSpy).toHaveBeenCalled();
		expect(preventSpy).toHaveBeenCalled();

		window.removeEventListener(
			'extendify-agent:cancel-workflow',
			cancelListener,
		);
	});
});

describe('wireGlobalEscape — clears the QE selection', () => {
	it('clears the QE selection and stops propagation', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.selected = { blockId: 's-1' };

		const cancelListener = jest.fn();
		window.addEventListener('extendify-agent:cancel-workflow', cancelListener);

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		const { stopSpy, preventSpy } = dispatchEsc();

		expect(mockClearSelected).toHaveBeenCalledTimes(1);
		expect(mockSetAgentBlock).not.toHaveBeenCalled();
		expect(cancelListener).not.toHaveBeenCalled();
		expect(stopSpy).toHaveBeenCalled();
		expect(preventSpy).toHaveBeenCalled();

		window.removeEventListener(
			'extendify-agent:cancel-workflow',
			cancelListener,
		);
	});
});

describe('wireGlobalEscape — clears the committed selection', () => {
	it('clears the committed selection and stops propagation', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.committedSelection = {
			el: 'fake',
			blockType: 'core/paragraph',
		};

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		const { stopSpy, preventSpy } = dispatchEsc();

		expect(mockSetCommittedSelection).toHaveBeenCalledWith(null);
		expect(mockSetAgentBlock).not.toHaveBeenCalled();
		expect(mockClearSelected).not.toHaveBeenCalled();
		expect(stopSpy).toHaveBeenCalled();
		expect(preventSpy).toHaveBeenCalled();
	});

	it('prefers clearing QE selection when both QE selection and committedSelection are set', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.selected = { blockId: 's-1' };
		mockQuickEditState.committedSelection = { el: 'fake' };

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		dispatchEsc();

		expect(mockClearSelected).toHaveBeenCalledTimes(1);
		expect(mockSetCommittedSelection).not.toHaveBeenCalled();
	});
});

describe('wireGlobalEscape — noop branch', () => {
	it('stops propagation but does not toggle edit mode when nothing is selected', async () => {
		mockEditModeState.on = true;

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		unwire = wireGlobalEscape();

		const { stopSpy, preventSpy } = dispatchEsc();

		expect(mockSetAgentBlock).not.toHaveBeenCalled();
		expect(mockClearSelected).not.toHaveBeenCalled();
		expect(stopSpy).toHaveBeenCalled();
		// preventDefault is reserved for the consuming branches; the noop
		// branch only stops propagation so legacy listeners stay quiet.
		expect(preventSpy).not.toHaveBeenCalled();
	});
});

describe('wireGlobalEscape — teardown', () => {
	it('returns an unsubscribe fn that detaches the listener', async () => {
		mockEditModeState.on = true;
		mockQuickEditState.agentBlock = { id: 'b-1' };

		const { wireGlobalEscape } = await import('@quick-edit/lib/global-escape');
		const teardown = wireGlobalEscape();
		teardown();
		unwire = () => {};

		dispatchEsc();

		expect(mockSetAgentBlock).not.toHaveBeenCalled();
	});
});
