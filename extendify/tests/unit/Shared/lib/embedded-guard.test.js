import { isEmbedded } from '@shared/lib/embedded-guard';

describe('isEmbedded', () => {
	it('reports not-embedded on a top-level window (self === top)', () => {
		const win = {};
		win.self = win;
		win.top = win;
		expect(isEmbedded(win)).toBe(false);
	});

	it('reports embedded when framed (self !== top)', () => {
		const win = { self: {}, top: {} };
		expect(isEmbedded(win)).toBe(true);
	});

	it('treats a cross-origin parent (top access throws) as embedded', () => {
		const win = { self: {} };
		Object.defineProperty(win, 'top', {
			get() {
				throw new Error('SecurityError: cross-origin frame');
			},
		});
		expect(isEmbedded(win)).toBe(true);
	});

	it('defaults to the real (top-level) window → not embedded', () => {
		expect(isEmbedded()).toBe(false);
	});
});
