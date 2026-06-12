// Mock zustand's persist middleware so it runs synchronously and we don't
// have to coordinate hydration timing per test.
jest.mock('zustand/middleware', () => ({
	devtools: (fn) => fn,
	persist: (config) => config,
}));

jest.mock('@quick-edit/lib/insights', () => ({
	track: jest.fn(),
}));

const trackedDocListeners = [];
const originalDocAddEventListener = document.addEventListener.bind(document);
document.addEventListener = (type, handler, opts) => {
	trackedDocListeners.push([type, handler, opts]);
	return originalDocAddEventListener(type, handler, opts);
};

const NODE_ID = 'wp-admin-bar-extendify-quick-edit-toggle';

const renderAdminBar = () => {
	document.body.innerHTML = `
		<ul id="wpadminbar">
			<li id="${NODE_ID}">
				<a href="#" role="switch" aria-label="Quick Edit">Quick Edit</a>
			</li>
		</ul>
	`;
	return document.querySelector(`#${NODE_ID} a`);
};

const loadModules = async () => {
	const { useEditModeStore } = await import('@quick-edit/state/edit-mode');
	const { bindAdminBarToggle } = await import('@quick-edit/lib/admin-bar');
	return { useEditModeStore, bindAdminBarToggle };
};

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	document.documentElement.className = '';
	document.body.innerHTML = '';
	window.extQuickEditData = undefined;
});

afterEach(() => {
	for (const [type, handler, opts] of trackedDocListeners) {
		document.removeEventListener(type, handler, opts);
	}
	trackedDocListeners.length = 0;
});

describe('bindAdminBarToggle — no-op when pill is missing', () => {
	it('returns silently when the admin-bar node is not present', async () => {
		const { bindAdminBarToggle, useEditModeStore } = await loadModules();
		expect(() => bindAdminBarToggle()).not.toThrow();
		expect(useEditModeStore.getState().on).toBe(false);
	});
});

describe('bindAdminBarToggle — initial aria-checked sync', () => {
	it('writes aria-checked="false" when edit mode is off', async () => {
		const link = renderAdminBar();
		const { bindAdminBarToggle } = await loadModules();
		bindAdminBarToggle();
		expect(link.getAttribute('aria-checked')).toBe('false');
	});

	it('writes aria-checked="true" when edit mode is on at bind time', async () => {
		window.extQuickEditData = { defaultOn: true };
		const link = renderAdminBar();
		const { bindAdminBarToggle } = await loadModules();
		bindAdminBarToggle();
		expect(link.getAttribute('aria-checked')).toBe('true');
	});
});

describe('bindAdminBarToggle — click handler', () => {
	it('toggles the edit-mode store and prevents default navigation', async () => {
		const link = renderAdminBar();
		const { bindAdminBarToggle, useEditModeStore } = await loadModules();
		bindAdminBarToggle();

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		const preventSpy = jest.spyOn(event, 'preventDefault');
		link.dispatchEvent(event);

		expect(preventSpy).toHaveBeenCalled();
		expect(useEditModeStore.getState().on).toBe(true);
	});

	it('a second click toggles back to off', async () => {
		const link = renderAdminBar();
		const { bindAdminBarToggle, useEditModeStore } = await loadModules();
		bindAdminBarToggle();

		link.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true }),
		);
		link.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true }),
		);

		expect(useEditModeStore.getState().on).toBe(false);
	});
});

describe('bindAdminBarToggle — store subscription mirrors aria-checked', () => {
	it('updates aria-checked when the store flips externally', async () => {
		const link = renderAdminBar();
		const { bindAdminBarToggle, useEditModeStore } = await loadModules();
		bindAdminBarToggle();

		useEditModeStore.getState().setOn(true);
		expect(link.getAttribute('aria-checked')).toBe('true');

		useEditModeStore.getState().setOn(false);
		expect(link.getAttribute('aria-checked')).toBe('false');
	});
});

describe('bindAdminBarToggle — idempotency', () => {
	it('only binds the click handler once across repeated calls', async () => {
		const link = renderAdminBar();
		const { bindAdminBarToggle, useEditModeStore } = await loadModules();
		bindAdminBarToggle();
		bindAdminBarToggle();
		bindAdminBarToggle();

		link.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true }),
		);

		// One click → one toggle. If the listener double-bound, on would be
		// false again after two toggles.
		expect(useEditModeStore.getState().on).toBe(true);
	});
});
