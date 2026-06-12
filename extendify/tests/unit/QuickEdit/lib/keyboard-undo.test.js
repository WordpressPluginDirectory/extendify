// keyboard-undo wires Cmd/Ctrl+Z to the cross-block undo stack and bails
// when any host editor / media frame / popover is open or when the
// keystroke originates in an editable surface.

jest.mock('@quick-edit/state/undo', () => ({
	ANNOUNCE_STORAGE_KEY: 'extendify-quick-edit-undo-announce',
	getStackDepth: jest.fn(),
	performUndo: jest.fn(),
}));

const trackedDocListeners = [];
const originalDocAddEventListener = document.addEventListener.bind(document);
document.addEventListener = (type, handler, opts) => {
	trackedDocListeners.push([type, handler, opts]);
	return originalDocAddEventListener(type, handler, opts);
};

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	document.body.innerHTML = '';
	window.sessionStorage.clear();
});

afterEach(async () => {
	const { detachKeyboardUndo } = await import('@quick-edit/lib/keyboard-undo');
	detachKeyboardUndo();
	for (const [type, handler, opts] of trackedDocListeners) {
		document.removeEventListener(type, handler, opts);
	}
	trackedDocListeners.length = 0;
});

const fireUndo = (init = {}) => {
	const event = new KeyboardEvent('keydown', {
		key: 'z',
		bubbles: true,
		cancelable: true,
		...init,
	});
	const preventSpy = jest.spyOn(event, 'preventDefault');
	document.dispatchEvent(event);
	return { event, preventSpy };
};

describe('attachKeyboardUndo — modifier matrix', () => {
	it('fires on Cmd+Z', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		const { preventSpy } = fireUndo({ metaKey: true });
		expect(undo.performUndo).toHaveBeenCalled();
		expect(preventSpy).toHaveBeenCalled();
	});

	it('fires on Ctrl+Z', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		fireUndo({ ctrlKey: true });
		expect(undo.performUndo).toHaveBeenCalled();
	});

	it('also accepts uppercase Z', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		fireUndo({ metaKey: true, key: 'Z' });
		expect(undo.performUndo).toHaveBeenCalled();
	});

	it('ignores Cmd+Z while Shift is held (Cmd+Shift+Z is "redo")', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		fireUndo({ metaKey: true, shiftKey: true });
		expect(undo.performUndo).not.toHaveBeenCalled();
	});

	it('ignores Cmd+Z while Alt is held', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		fireUndo({ metaKey: true, altKey: true });
		expect(undo.performUndo).not.toHaveBeenCalled();
	});

	it('ignores plain Z', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		fireUndo({});
		expect(undo.performUndo).not.toHaveBeenCalled();
	});
});

describe('attachKeyboardUndo — host-element bail-outs', () => {
	it.each([
		['.extendify-quick-edit-host'],
		['.media-modal'],
		['.extendify-quick-edit-color-popover'],
		['.extendify-quick-edit-image-menu'],
	])('bails when %s is mounted', async (selector) => {
		const host = document.createElement('div');
		host.className = selector.slice(1);
		document.body.appendChild(host);

		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		fireUndo({ metaKey: true });
		expect(undo.performUndo).not.toHaveBeenCalled();
	});

	it('bails when the keystroke target is a non-empty INPUT/TEXTAREA or a SELECT', async () => {
		const input = document.createElement('input');
		input.value = 'typed';
		const textarea = document.createElement('textarea');
		textarea.value = 'typed';
		const select = document.createElement('select');
		document.body.append(input, textarea, select);

		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		for (const el of [input, textarea, select]) {
			const event = new KeyboardEvent('keydown', {
				key: 'z',
				metaKey: true,
				bubbles: true,
				cancelable: true,
			});
			Object.defineProperty(event, 'target', { value: el });
			document.dispatchEvent(event);
		}
		expect(undo.performUndo).not.toHaveBeenCalled();
	});

	// An empty field has no native undo to protect, so it must not swallow the
	// page-level undo: the agent chat box auto-focuses empty on the frontend
	// after a Quick Edit save + reload, and Cmd+Z there should still revert.
	it('fires when the keystroke target is an empty INPUT/TEXTAREA', async () => {
		const input = document.createElement('input');
		const textarea = document.createElement('textarea');
		document.body.append(input, textarea);

		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		for (const el of [input, textarea]) {
			const event = new KeyboardEvent('keydown', {
				key: 'z',
				metaKey: true,
				bubbles: true,
				cancelable: true,
			});
			Object.defineProperty(event, 'target', { value: el });
			document.dispatchEvent(event);
		}
		expect(undo.performUndo).toHaveBeenCalledTimes(2);
	});

	it('bails when the keystroke target is contentEditable', async () => {
		const editable = document.createElement('div');
		// jsdom doesn't auto-derive isContentEditable from the attribute; set explicitly.
		Object.defineProperty(editable, 'isContentEditable', {
			value: true,
			configurable: true,
		});
		document.body.appendChild(editable);

		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();

		const event = new KeyboardEvent('keydown', {
			key: 'z',
			metaKey: true,
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, 'target', { value: editable });
		document.dispatchEvent(event);
		expect(undo.performUndo).not.toHaveBeenCalled();
	});

	it('bails when the stack is empty', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(0);
		attachKeyboardUndo();

		const { preventSpy } = fireUndo({ metaKey: true });
		expect(undo.performUndo).not.toHaveBeenCalled();
		expect(preventSpy).not.toHaveBeenCalled();
	});
});

describe('detachKeyboardUndo', () => {
	it('removes the listener so subsequent shortcuts no-op', async () => {
		const { attachKeyboardUndo, detachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();
		detachKeyboardUndo();

		fireUndo({ metaKey: true });
		expect(undo.performUndo).not.toHaveBeenCalled();
	});

	it('repeated attach is idempotent (no double-fire)', async () => {
		const { attachKeyboardUndo } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		const undo = require('@quick-edit/state/undo');
		undo.getStackDepth.mockReturnValue(1);
		attachKeyboardUndo();
		attachKeyboardUndo();

		fireUndo({ metaKey: true });
		expect(undo.performUndo).toHaveBeenCalledTimes(1);
	});
});

describe('announcePostReload', () => {
	it('reads + clears sessionStorage and mounts a polite aria-live region with the message', async () => {
		jest.useFakeTimers();
		window.sessionStorage.setItem(
			'extendify-quick-edit-undo-announce',
			'Reverted last change.',
		);

		const { announcePostReload } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		announcePostReload();

		expect(
			window.sessionStorage.getItem('extendify-quick-edit-undo-announce'),
		).toBeNull();
		const live = document.querySelector('[role="status"]');
		expect(live).not.toBeNull();
		expect(live.getAttribute('aria-live')).toBe('polite');
		expect(live.getAttribute('aria-atomic')).toBe('true');
		// Empty on mount; text set on next tick.
		expect(live.textContent).toBe('');

		jest.advanceTimersByTime(100);
		expect(live.textContent).toBe('Reverted last change.');

		jest.advanceTimersByTime(5000);
		expect(document.querySelector('[role="status"]')).toBeNull();
		jest.useRealTimers();
	});

	it('is a no-op when sessionStorage has no announcement', async () => {
		const { announcePostReload } = await import(
			'@quick-edit/lib/keyboard-undo'
		);
		announcePostReload();
		expect(document.querySelector('[role="status"]')).toBeNull();
	});
});
