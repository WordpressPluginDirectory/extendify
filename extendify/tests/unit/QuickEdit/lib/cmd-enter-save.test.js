// useCmdEnterSave attaches a capture-phase keydown listener while
// enabled=true and fires onSave on Cmd/Ctrl+Enter. Tests render a host
// component via @testing-library/react so the React effect lifecycle
// (mount / unmount / dep-change cleanup) drives the listener
// attach/detach instead of being mocked.

import { useCmdEnterSave } from '@quick-edit/lib/cmd-enter-save';
import { render } from '@testing-library/react';

const Host = ({ onSave, enabled }) => {
	useCmdEnterSave(onSave, enabled);
	return null;
};

const fireKeydown = (init) => {
	const event = new KeyboardEvent('keydown', {
		bubbles: true,
		cancelable: true,
		...init,
	});
	const preventSpy = jest.spyOn(event, 'preventDefault');
	const stopSpy = jest.spyOn(event, 'stopPropagation');
	window.dispatchEvent(event);
	return { event, preventSpy, stopSpy };
};

describe('useCmdEnterSave — modifier matrix', () => {
	const cases = [
		['Cmd+Enter (metaKey)', { key: 'Enter', metaKey: true }, true],
		['Ctrl+Enter (ctrlKey)', { key: 'Enter', ctrlKey: true }, true],
		['plain Enter', { key: 'Enter' }, false],
		['Cmd+A', { key: 'a', metaKey: true }, false],
		['Cmd+Shift+Enter', { key: 'Enter', metaKey: true, shiftKey: true }, true],
	];

	for (const [name, init, shouldFire] of cases) {
		it(`${shouldFire ? 'fires' : 'ignores'} ${name}`, () => {
			const onSave = jest.fn();
			render(<Host onSave={onSave} enabled={true} />);
			fireKeydown(init);
			expect(onSave).toHaveBeenCalledTimes(shouldFire ? 1 : 0);
		});
	}
});

describe('useCmdEnterSave — event prevention', () => {
	it('preventsDefault and stopsPropagation on a match', () => {
		const onSave = jest.fn();
		render(<Host onSave={onSave} enabled={true} />);
		const { preventSpy, stopSpy } = fireKeydown({
			key: 'Enter',
			metaKey: true,
		});
		expect(preventSpy).toHaveBeenCalled();
		expect(stopSpy).toHaveBeenCalled();
	});

	it('does not preventDefault on a miss', () => {
		const onSave = jest.fn();
		render(<Host onSave={onSave} enabled={true} />);
		const { preventSpy } = fireKeydown({ key: 'Enter' });
		expect(preventSpy).not.toHaveBeenCalled();
	});
});

describe('useCmdEnterSave — enabled gate', () => {
	it('does not attach the listener when enabled=false', () => {
		const onSave = jest.fn();
		render(<Host onSave={onSave} enabled={false} />);
		fireKeydown({ key: 'Enter', metaKey: true });
		expect(onSave).not.toHaveBeenCalled();
	});

	it('defaults enabled=true when the second arg is omitted', () => {
		const Default = ({ onSave }) => {
			useCmdEnterSave(onSave);
			return null;
		};
		const onSave = jest.fn();
		render(<Default onSave={onSave} />);
		fireKeydown({ key: 'Enter', metaKey: true });
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it('re-attaches when enabled flips false → true', () => {
		const onSave = jest.fn();
		const { rerender } = render(<Host onSave={onSave} enabled={false} />);
		fireKeydown({ key: 'Enter', metaKey: true });
		expect(onSave).not.toHaveBeenCalled();

		rerender(<Host onSave={onSave} enabled={true} />);
		fireKeydown({ key: 'Enter', metaKey: true });
		expect(onSave).toHaveBeenCalledTimes(1);
	});
});

describe('useCmdEnterSave — cleanup', () => {
	it('removes the listener on unmount', () => {
		const onSave = jest.fn();
		const { unmount } = render(<Host onSave={onSave} enabled={true} />);
		unmount();
		fireKeydown({ key: 'Enter', metaKey: true });
		expect(onSave).not.toHaveBeenCalled();
	});

	it('removes the prior listener when onSave changes (no duplicate fires)', () => {
		const first = jest.fn();
		const second = jest.fn();
		const { rerender } = render(<Host onSave={first} enabled={true} />);
		rerender(<Host onSave={second} enabled={true} />);
		fireKeydown({ key: 'Enter', metaKey: true });
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});
});

describe('useCmdEnterSave — onSave null-safety', () => {
	it('does not throw when onSave is null and the shortcut fires', () => {
		render(<Host onSave={null} enabled={true} />);
		expect(() => fireKeydown({ key: 'Enter', metaKey: true })).not.toThrow();
	});
});
