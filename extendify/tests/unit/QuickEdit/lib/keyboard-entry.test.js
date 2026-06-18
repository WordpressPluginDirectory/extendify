// keyboard-entry decorates tagged elements with tabindex/role/aria-label
// on attach, drives the hover bar via focusin/focusout, and activates the
// editor on Enter/Space. Tests mock hover-bar so we can assert exactly
// which calls each event drives, and restore document.addEventListener
// across resetModules to prevent listener stacking.

jest.mock('@quick-edit/lib/hover-bar', () => ({
	hideBar: jest.fn(),
	showBar: jest.fn(),
	editTarget: jest.fn(),
	askAiTarget: jest.fn(),
	pillContextFor: jest.fn(() => ({ quickEditable: true, aiAvailable: false })),
}));

const trackedDocListeners = [];
const originalDocAddEventListener = document.addEventListener.bind(document);
document.addEventListener = (type, handler, opts) => {
	trackedDocListeners.push([type, handler, opts]);
	return originalDocAddEventListener(type, handler, opts);
};

const loadModule = async () => {
	const mod = await import('@quick-edit/lib/keyboard-entry');
	return mod;
};

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	document.body.innerHTML = '';
	delete window.extQuickEditData;
});

afterEach(async () => {
	const { detachKeyboardEntry } = await import(
		'@quick-edit/lib/keyboard-entry'
	);
	detachKeyboardEntry();
	for (const [type, handler, opts] of trackedDocListeners) {
		document.removeEventListener(type, handler, opts);
	}
	trackedDocListeners.length = 0;
});

describe('attachKeyboardEntry — decorate', () => {
	it('adds tabindex=0 and role=button to a tagged <div>', async () => {
		const el = document.createElement('div');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		attachKeyboardEntry({ getSession: () => null });

		expect(el.getAttribute('tabindex')).toBe('0');
		expect(el.getAttribute('role')).toBe('button');
		expect(el.getAttribute('aria-label')).toBeTruthy();
	});

	it('omits role=button on heading / link / landmark tags', async () => {
		for (const tag of ['h1', 'h2', 'a', 'nav', 'header', 'main', 'footer']) {
			document.body.innerHTML = '';
			jest.resetModules();
			const el = document.createElement(tag);
			el.setAttribute('data-extendify-agent-block-id', '1');
			document.body.appendChild(el);

			const { attachKeyboardEntry } = await import(
				'@quick-edit/lib/keyboard-entry'
			);
			attachKeyboardEntry({ getSession: () => null });
			expect(el.getAttribute('role')).toBeNull();
		}
	});

	it('truncates aria-label text past 60 chars and adds Replace image for image/cover targets', async () => {
		const long = 'a'.repeat(120);
		const text = document.createElement('p');
		text.setAttribute('data-extendify-agent-block-id', '1');
		text.textContent = long;
		document.body.appendChild(text);

		const image = document.createElement('figure');
		image.setAttribute('data-extendify-agent-block-id', '2');
		image.classList.add('wp-block-image');
		image.textContent = 'Photo';
		document.body.appendChild(image);

		const { attachKeyboardEntry } = await loadModule();
		attachKeyboardEntry({ getSession: () => null });

		const textLabel = text.getAttribute('aria-label');
		expect(textLabel.startsWith('Edit "')).toBe(true);
		expect(textLabel.includes('…')).toBe(true);
		expect(image.getAttribute('aria-label')).toBe('Replace image "Photo"');
	});

	it('is idempotent — decorating twice does not re-snapshot the previous values', async () => {
		const el = document.createElement('p');
		el.setAttribute('data-extendify-agent-block-id', '1');
		el.setAttribute('tabindex', '5');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		attachKeyboardEntry({ getSession: () => null });
		expect(el.getAttribute('data-extendify-quick-edit-kb-prev-tab')).toBe('5');

		// Manually re-call decorate semantics by detach + attach.
		const { detachKeyboardEntry } = await import(
			'@quick-edit/lib/keyboard-entry'
		);
		detachKeyboardEntry();
		expect(el.getAttribute('tabindex')).toBe('5');

		attachKeyboardEntry({ getSession: () => null });
		expect(el.getAttribute('data-extendify-quick-edit-kb-prev-tab')).toBe('5');
	});

	it('does nothing on a second attach call (attached flag)', async () => {
		const el = document.createElement('div');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		attachKeyboardEntry({ getSession: () => null });
		const firstTab = el.getAttribute('tabindex');

		el.setAttribute('tabindex', '99');
		attachKeyboardEntry({ getSession: () => null });
		// Second call returns early — el's manually-changed tabindex stays.
		expect(el.getAttribute('tabindex')).toBe('99');
		expect(firstTab).toBe('0');
	});
});

describe('attachKeyboardEntry — focusin → hover bar', () => {
	it('hides the prior bar and shows the new one for a focused tagged element', async () => {
		const el = document.createElement('div');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const { hideBar, showBar } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => null });
		hideBar.mockClear();
		showBar.mockClear();

		el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(hideBar).toHaveBeenCalled();
		expect(showBar).toHaveBeenCalledWith(el);
	});

	it('skips the bar when getSession returns truthy (active inline editor)', async () => {
		const el = document.createElement('div');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const { showBar } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => ({ id: 'session-1' }) });

		el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(showBar).not.toHaveBeenCalled();
	});
});

describe('attachKeyboardEntry — Enter/Space activation', () => {
	it('fires editTarget when Enter is pressed on a tagged paragraph', async () => {
		const el = document.createElement('p');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const { editTarget, showBar } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => null });
		editTarget.mockClear();
		showBar.mockClear();

		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, 'target', { value: el });
		const preventSpy = jest.spyOn(event, 'preventDefault');
		document.dispatchEvent(event);

		expect(preventSpy).toHaveBeenCalled();
		expect(editTarget).toHaveBeenCalled();
		expect(showBar).toHaveBeenCalledWith(el);
	});

	it('fires editTarget on Space too', async () => {
		const el = document.createElement('p');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const { editTarget } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => null });
		editTarget.mockClear();

		const event = new KeyboardEvent('keydown', {
			key: ' ',
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, 'target', { value: el });
		document.dispatchEvent(event);

		expect(editTarget).toHaveBeenCalled();
	});

	it('ignores other keys (Tab, ArrowDown, etc.)', async () => {
		const el = document.createElement('p');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const { editTarget } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => null });
		editTarget.mockClear();

		for (const key of ['Tab', 'ArrowDown', 'a']) {
			const event = new KeyboardEvent('keydown', {
				key,
				bubbles: true,
				cancelable: true,
			});
			Object.defineProperty(event, 'target', { value: el });
			document.dispatchEvent(event);
		}
		expect(editTarget).not.toHaveBeenCalled();
	});

	it('does not activate when the keystroke target is a child of the tagged element', async () => {
		const el = document.createElement('li');
		el.setAttribute('data-extendify-agent-block-id', '1');
		const child = document.createElement('a');
		child.href = '#';
		el.appendChild(child);
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const { editTarget } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => null });
		editTarget.mockClear();

		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, 'target', { value: child });
		document.dispatchEvent(event);

		expect(editTarget).not.toHaveBeenCalled();
	});
});

describe('attachKeyboardEntry — Ask-AI-only blocks', () => {
	it('announces an Ask-AI-only block as "Ask AI about …" instead of "Edit"', async () => {
		const el = document.createElement('div');
		el.classList.add('wp-block-group');
		el.setAttribute('data-extendify-agent-block-id', '1');
		el.textContent = 'A group with no inline editor';
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const { pillContextFor } = require('@quick-edit/lib/hover-bar');
		pillContextFor.mockReturnValue({ quickEditable: false, aiAvailable: true });
		attachKeyboardEntry({ getSession: () => null });

		expect(el.getAttribute('aria-label')).toBe(
			'Ask AI about "A group with no inline editor"',
		);
	});

	it('routes Enter on an Ask-AI-only block to the agent, not the editor or bar', async () => {
		const el = document.createElement('div');
		el.classList.add('wp-block-group');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const {
			pillContextFor,
			askAiTarget,
			editTarget,
			showBar,
		} = require('@quick-edit/lib/hover-bar');
		pillContextFor.mockReturnValue({ quickEditable: false, aiAvailable: true });
		attachKeyboardEntry({ getSession: () => null });
		askAiTarget.mockClear();
		editTarget.mockClear();
		showBar.mockClear();

		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, 'target', { value: el });
		document.dispatchEvent(event);

		expect(askAiTarget).toHaveBeenCalledWith(el);
		expect(editTarget).not.toHaveBeenCalled();
		expect(showBar).not.toHaveBeenCalled();
	});

	it('opens the editor (not the agent) on Enter for a block that is both quick-editable and AI-eligible', async () => {
		const el = document.createElement('p');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry } = await loadModule();
		const {
			pillContextFor,
			askAiTarget,
			editTarget,
		} = require('@quick-edit/lib/hover-bar');
		pillContextFor.mockReturnValue({ quickEditable: true, aiAvailable: true });
		attachKeyboardEntry({ getSession: () => null });
		askAiTarget.mockClear();
		editTarget.mockClear();

		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, 'target', { value: el });
		document.dispatchEvent(event);

		expect(editTarget).toHaveBeenCalled();
		expect(askAiTarget).not.toHaveBeenCalled();
	});
});

describe('detachKeyboardEntry — undecorate', () => {
	it('restores prior tabindex / role / aria-label and removes the kb-ready marker', async () => {
		const el = document.createElement('p');
		el.setAttribute('data-extendify-agent-block-id', '1');
		el.setAttribute('tabindex', '5');
		el.setAttribute('role', 'menuitem');
		el.setAttribute('aria-label', 'Original');
		document.body.appendChild(el);

		const { attachKeyboardEntry, detachKeyboardEntry } = await loadModule();
		attachKeyboardEntry({ getSession: () => null });
		expect(el.getAttribute('tabindex')).toBe('0');

		detachKeyboardEntry();
		expect(el.getAttribute('tabindex')).toBe('5');
		expect(el.getAttribute('role')).toBe('menuitem');
		expect(el.getAttribute('aria-label')).toBe('Original');
		expect(el.hasAttribute('data-extendify-quick-edit-kb-ready')).toBe(false);
	});

	it('removes the attribute entirely when there was no prior value', async () => {
		const el = document.createElement('div');
		el.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(el);

		const { attachKeyboardEntry, detachKeyboardEntry } = await loadModule();
		attachKeyboardEntry({ getSession: () => null });
		expect(el.getAttribute('tabindex')).toBe('0');

		detachKeyboardEntry();
		expect(el.hasAttribute('tabindex')).toBe(false);
		expect(el.hasAttribute('role')).toBe(false);
	});
});

// focusout → hideBar defers via setTimeout(0); if the focused element
// detached first, it must skip hideBar or it tears down the just-rendered bar.
describe('attachKeyboardEntry — onFocusOut deferred hideBar', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const fireFocusOut = (target) =>
		target.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

	it('does NOT hide the bar when the focusout target detaches before the deferred check', async () => {
		const tagged = document.createElement('div');
		tagged.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(tagged);
		const editable = document.createElement('textarea');
		document.body.appendChild(editable);

		const { attachKeyboardEntry } = await loadModule();
		const { hideBar } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => null });
		hideBar.mockClear();

		fireFocusOut(editable);
		editable.remove();
		jest.advanceTimersByTime(0);

		expect(hideBar).not.toHaveBeenCalled();
	});

	it('still hides the bar when focus leaves a tagged block to an attached non-tagged element', async () => {
		const tagged = document.createElement('div');
		tagged.setAttribute('data-extendify-agent-block-id', '1');
		document.body.appendChild(tagged);
		const otherButton = document.createElement('button');
		document.body.appendChild(otherButton);

		const { attachKeyboardEntry } = await loadModule();
		const { hideBar } = require('@quick-edit/lib/hover-bar');
		attachKeyboardEntry({ getSession: () => null });
		hideBar.mockClear();

		fireFocusOut(tagged);
		otherButton.focus();
		jest.advanceTimersByTime(0);

		expect(hideBar).toHaveBeenCalled();
	});
});
