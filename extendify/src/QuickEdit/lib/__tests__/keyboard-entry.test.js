// onFocusOut deferred branch (setTimeout(0)): when the focused element
// disappears from the DOM during the deferral (QE canvas unmount on
// Esc / Cancel / Save), the body-focus → hideBar branch would otherwise
// tear down the freshly-rendered bar that hover-bar's `selected → null`
// subscriber placed synchronously. The fix snapshots the focusout target
// and skips hideBar when it has detached by setTimeout time.

jest.mock('@quick-edit/lib/hover-bar', () => ({
	editTarget: jest.fn(),
	hideBar: jest.fn(),
	showBar: jest.fn(),
	askAiTarget: jest.fn(),
	pillContextFor: jest.fn(() => ({ quickEditable: true, aiAvailable: false })),
}));
jest.mock('@quick-edit/lib/quick-edit-handlers', () => ({
	hasQuickEditModalFor: jest.fn(() => true),
}));
jest.mock('@quick-edit/lib/dom', () => ({
	resolveTarget: jest.fn(() => ({ blockType: 'core/paragraph' })),
}));

describe('keyboard-entry: onFocusOut deferred hideBar', () => {
	let attachKeyboardEntry;
	let detachKeyboardEntry;
	let hideBar;

	beforeEach(() => {
		jest.resetModules();
		jest.useFakeTimers();
		const mod = require('@quick-edit/lib/keyboard-entry');
		attachKeyboardEntry = mod.attachKeyboardEntry;
		detachKeyboardEntry = mod.detachKeyboardEntry;
		({ hideBar } = require('@quick-edit/lib/hover-bar'));
		hideBar.mockClear();
	});

	afterEach(() => {
		detachKeyboardEntry();
		jest.useRealTimers();
		document.body.innerHTML = '';
	});

	const fireFocusOut = (target) =>
		target.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

	it('does NOT hide the bar when the focusout target is detached by setTimeout time', () => {
		const tagged = document.createElement('div');
		tagged.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(tagged);
		// Editable inside the QE canvas — gets removed by React unmount in
		// real flows. We seed it as a separate tree so detaching is local.
		const editable = document.createElement('textarea');
		document.body.appendChild(editable);

		attachKeyboardEntry({ getSession: () => false });

		fireFocusOut(editable);
		// Editable is removed before the setTimeout(0) callback runs —
		// exactly mirrors React's commit ordering on Esc.
		editable.remove();

		jest.advanceTimersByTime(0);

		expect(hideBar).not.toHaveBeenCalled();
	});

	it('still hides the bar on Tab off a tagged block to a non-tagged area (target stays attached)', () => {
		const tagged = document.createElement('div');
		tagged.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(tagged);
		const otherButton = document.createElement('button');
		document.body.appendChild(otherButton);

		attachKeyboardEntry({ getSession: () => false });

		fireFocusOut(tagged);
		// Tab moves focus to a non-tagged element — focusout fires but
		// the tagged block stays in the DOM.
		otherButton.focus();

		jest.advanceTimersByTime(0);

		expect(hideBar).toHaveBeenCalled();
	});
});
