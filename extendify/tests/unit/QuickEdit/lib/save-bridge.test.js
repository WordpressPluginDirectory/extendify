// Pins the save-bridge contract: register/unregister, saveSelected is a
// no-op without a registered saver, the agent-submit window event fires
// the saver with alsoClear: true.

import {
	AGENT_SUBMIT_EVENT,
	hasSaver,
	registerSaver,
	saveSelected,
	unregisterSaver,
} from '@quick-edit/lib/save-bridge';

afterEach(() => {
	unregisterSaver(unregisterSaver);
});

describe('save-bridge', () => {
	it('hasSaver is false before any registration', () => {
		expect(hasSaver()).toBe(false);
	});

	it('register + saveSelected fires the registered fn', async () => {
		const fn = jest.fn().mockResolvedValue('ok');
		registerSaver(fn);
		expect(hasSaver()).toBe(true);
		await saveSelected();
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith({});
		unregisterSaver(fn);
	});

	it('saveSelected forwards options through to the saver', async () => {
		const fn = jest.fn().mockResolvedValue('ok');
		registerSaver(fn);
		await saveSelected({ alsoClear: false });
		expect(fn).toHaveBeenCalledWith({ alsoClear: false });
		unregisterSaver(fn);
	});

	it('unregister leaves saveSelected a no-op', async () => {
		const fn = jest.fn();
		registerSaver(fn);
		unregisterSaver(fn);
		expect(hasSaver()).toBe(false);
		await saveSelected();
		expect(fn).not.toHaveBeenCalled();
	});

	it('agent-submit window event fires the saver with alsoClear: true', () => {
		const fn = jest.fn();
		registerSaver(fn);
		window.dispatchEvent(new CustomEvent(AGENT_SUBMIT_EVENT));
		expect(fn).toHaveBeenCalledWith({ alsoClear: true });
		unregisterSaver(fn);
	});

	// Same-origin trigger surface: the agent-submit listener
	// must NOT read event.detail. A hostile same-origin script (a second
	// plugin, a stored-XSS elsewhere) can dispatch this event, but it can only
	// flush the editor's already-staged content — never inject its own. If the
	// listener ever forwarded e.detail, an attacker could choose what gets
	// saved without the user's intent. Dispatch a poisoned payload and assert
	// the saver still receives exactly { alsoClear: true } and nothing else.
	it('agent-submit ignores attacker-supplied event detail', () => {
		const fn = jest.fn();
		registerSaver(fn);
		window.dispatchEvent(
			new CustomEvent(AGENT_SUBMIT_EVENT, {
				detail: {
					alsoClear: false,
					rawBlock: '<img src=x onerror=alert(1)>',
					source: { kind: 'post', id: 999 },
				},
			}),
		);
		expect(fn).toHaveBeenCalledTimes(1);
		const args = fn.mock.calls[0][0];
		expect(args).toEqual({ alsoClear: true });
		expect(args).not.toHaveProperty('rawBlock');
		expect(args).not.toHaveProperty('source');
		unregisterSaver(fn);
	});

	it('agent-submit event is a no-op when no saver is registered', () => {
		expect(() => {
			window.dispatchEvent(new CustomEvent(AGENT_SUBMIT_EVENT));
		}).not.toThrow();
	});

	it('register twice replaces — only the latest saver fires', () => {
		const first = jest.fn();
		const second = jest.fn();
		registerSaver(first);
		registerSaver(second);
		window.dispatchEvent(new CustomEvent(AGENT_SUBMIT_EVENT));
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
		unregisterSaver(second);
	});

	it('unregister of a different fn does not clear the active saver', async () => {
		const active = jest.fn();
		const ghost = jest.fn();
		registerSaver(active);
		unregisterSaver(ghost);
		expect(hasSaver()).toBe(true);
		await saveSelected();
		expect(active).toHaveBeenCalledTimes(1);
		unregisterSaver(active);
	});
});
