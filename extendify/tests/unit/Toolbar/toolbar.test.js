/**
 * Characterization tests for the simple Extendify toolbar bridge.
 *
 * The toolbar.js module is a vanilla-JS bootstrap with no exports —
 * it self-runs `init()` at import time. Each test rebuilds the DOM
 * and uses `jest.isolateModulesAsync` so the side effects of one
 * test never leak into the next.
 *
 * Pinned behaviors:
 *  - No-op when `#extendify-toolbar` is missing (theme without
 *    `wp_body_open` won't blow up).
 *  - AI Agent button starts disabled with a loading title, then
 *    enables once the Agent has mounted its admin-bar button.
 *  - AI Agent click drives the Agent's mounted host button.
 *  - Quick Edit click dispatches the `extendify-quick-edit:toggle`
 *    custom event and prevents default navigation.
 *  - `aria-checked` mirrors the `extendify-quick-edit-on` class
 *    on `<html>` so any toggle source keeps the radio visually
 *    in sync.
 *  - When the Agent sidebar opens (its `inert` attribute is
 *    removed) the toolbar gets `ext-tb-agent-open`. When it
 *    closes (the `inert` attribute is set), the class is removed.
 *
 * Characterization finding — sidebar watcher is timing-sensitive:
 * `watchAgentSidebar` only attaches the inner `inert` observer when
 * its body-level MutationObserver fires. The `takeRecords()` fallback
 * for an already-mounted sidebar empties the queue but does NOT
 * invoke the callback, so a sidebar that exists BEFORE toolbar.js
 * initializes is silently ignored — its `inert` changes never flip
 * `ext-tb-agent-open`. In production this is invisible: toolbar.js
 * runs at DOMContentLoaded and the Agent mounts its sidebar later
 * via React, so the late-mount path is the one that actually fires.
 */

const renderToolbar = () => {
	document.body.innerHTML = `
		<div id="extendify-toolbar">
			<button type="button" id="ext-tb-ai-agent">AI Agent</button>
			<button type="button" id="ext-tb-quick-edit" role="switch" aria-checked="false">Quick Edit</button>
		</div>
	`;
};

const mountAgentButton = () => {
	const host = document.createElement('li');
	host.id = 'wp-admin-bar-extendify-agent-btn';
	const inner = document.createElement('button');
	inner.type = 'button';
	host.appendChild(inner);
	document.body.appendChild(host);
	return inner;
};

const mountAgentSidebar = ({ open }) => {
	const node = document.createElement('div');
	node.id = 'extendify-agent-sidebar';
	if (!open) node.setAttribute('inert', '');
	document.body.appendChild(node);
	return node;
};

const tick = () => new Promise((r) => setTimeout(r, 0));

const importToolbar = async () => {
	await jest.isolateModulesAsync(async () => {
		await import('@toolbar/toolbar');
	});
};

beforeEach(() => {
	jest.resetModules();
	jest.useRealTimers();
	document.documentElement.className = '';
	document.body.innerHTML = '';
});

describe('toolbar — no-op when host missing', () => {
	it('returns silently when #extendify-toolbar is not in the DOM', async () => {
		await expect(importToolbar()).resolves.toBeUndefined();
	});
});

describe('toolbar — AI Agent button loading state', () => {
	it('starts disabled with a loading title and aria-busy=true', async () => {
		jest.useFakeTimers();
		renderToolbar();

		await importToolbar();

		const btn = document.getElementById('ext-tb-ai-agent');
		expect(btn.disabled).toBe(true);
		expect(btn.title).toBe('Loading…');
		expect(btn.getAttribute('aria-busy')).toBe('true');
	});

	it('enables and clears the loading title once the Agent button mounts', async () => {
		jest.useFakeTimers();
		renderToolbar();

		await importToolbar();

		mountAgentButton();
		await jest.advanceTimersByTimeAsync(50);

		const btn = document.getElementById('ext-tb-ai-agent');
		expect(btn.disabled).toBe(false);
		expect(btn.title).toBe('');
		expect(btn.getAttribute('aria-busy')).toBe('false');
	});

	it('falls back to an unavailable title when the Agent never appears', async () => {
		jest.useFakeTimers();
		renderToolbar();

		await importToolbar();

		// Module polls 100 times at 50ms intervals. Drain them all.
		await jest.advanceTimersByTimeAsync(100 * 50 + 10);

		const btn = document.getElementById('ext-tb-ai-agent');
		expect(btn.title).toBe('AI Agent unavailable');
		expect(btn.getAttribute('aria-busy')).toBe('false');
	});
});

describe('toolbar — AI Agent click drives the Agent host button', () => {
	it('clicks the mounted Agent button when it is already present', async () => {
		renderToolbar();
		const agentBtn = mountAgentButton();
		const clickSpy = jest.spyOn(agentBtn, 'click');

		await importToolbar();
		await tick();

		const aiBtn = document.getElementById('ext-tb-ai-agent');
		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		const preventSpy = jest.spyOn(event, 'preventDefault');
		aiBtn.dispatchEvent(event);

		expect(preventSpy).toHaveBeenCalled();
		expect(clickSpy).toHaveBeenCalledTimes(1);
	});

	it('clicks the host element itself when it has no inner button', async () => {
		renderToolbar();
		const host = document.createElement('li');
		host.id = 'wp-admin-bar-extendify-agent-btn';
		host.click = jest.fn();
		document.body.appendChild(host);

		await importToolbar();
		await tick();

		document
			.getElementById('ext-tb-ai-agent')
			.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);

		expect(host.click).toHaveBeenCalled();
	});
});

describe('toolbar — Quick Edit toggle event', () => {
	it('dispatches extendify-quick-edit:toggle and prevents default on click', async () => {
		renderToolbar();
		await importToolbar();

		const listener = jest.fn();
		window.addEventListener('extendify-quick-edit:toggle', listener);

		const btn = document.getElementById('ext-tb-quick-edit');
		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		const preventSpy = jest.spyOn(event, 'preventDefault');
		btn.dispatchEvent(event);

		expect(preventSpy).toHaveBeenCalled();
		expect(listener).toHaveBeenCalledTimes(1);

		window.removeEventListener('extendify-quick-edit:toggle', listener);
	});
});

describe('toolbar — aria-checked mirrors the html.extendify-quick-edit-on class', () => {
	it('initial sync writes aria-checked=false when the class is absent', async () => {
		renderToolbar();
		await importToolbar();

		expect(
			document.getElementById('ext-tb-quick-edit').getAttribute('aria-checked'),
		).toBe('false');
	});

	it('initial sync writes aria-checked=true when the class is already present', async () => {
		document.documentElement.classList.add('extendify-quick-edit-on');
		renderToolbar();

		await importToolbar();

		expect(
			document.getElementById('ext-tb-quick-edit').getAttribute('aria-checked'),
		).toBe('true');
	});

	it('flips aria-checked to true when the class is added later', async () => {
		renderToolbar();
		await importToolbar();

		document.documentElement.classList.add('extendify-quick-edit-on');
		await tick();

		expect(
			document.getElementById('ext-tb-quick-edit').getAttribute('aria-checked'),
		).toBe('true');
	});

	it('flips aria-checked back to false when the class is removed', async () => {
		document.documentElement.classList.add('extendify-quick-edit-on');
		renderToolbar();
		await importToolbar();

		document.documentElement.classList.remove('extendify-quick-edit-on');
		await tick();

		expect(
			document.getElementById('ext-tb-quick-edit').getAttribute('aria-checked'),
		).toBe('false');
	});
});

describe('toolbar — Agent sidebar inert watcher', () => {
	it('picks up a sidebar that mounts AFTER the toolbar has loaded (open)', async () => {
		renderToolbar();
		await importToolbar();

		mountAgentSidebar({ open: true });
		await tick();

		const toolbar = document.getElementById('extendify-toolbar');
		expect(toolbar.classList.contains('ext-tb-agent-open')).toBe(true);
	});

	it('picks up a sidebar that mounts AFTER the toolbar has loaded (closed)', async () => {
		renderToolbar();
		await importToolbar();

		mountAgentSidebar({ open: false });
		await tick();

		const toolbar = document.getElementById('extendify-toolbar');
		expect(toolbar.classList.contains('ext-tb-agent-open')).toBe(false);
	});

	it('toggles ext-tb-agent-open when the sidebar inert attribute changes', async () => {
		renderToolbar();
		await importToolbar();

		const sidebar = mountAgentSidebar({ open: false });
		await tick();

		const toolbar = document.getElementById('extendify-toolbar');
		expect(toolbar.classList.contains('ext-tb-agent-open')).toBe(false);

		sidebar.removeAttribute('inert');
		await tick();
		expect(toolbar.classList.contains('ext-tb-agent-open')).toBe(true);

		sidebar.setAttribute('inert', '');
		await tick();
		expect(toolbar.classList.contains('ext-tb-agent-open')).toBe(false);
	});

	it('silently ignores a sidebar that was already in the DOM before init (known timing gap)', async () => {
		// `watchAgentSidebar` calls `observer.takeRecords()` for the
		// pre-existing case, but that empties the queue without firing
		// the callback — so the inner inert observer never attaches.
		// Class stays unset and later inert changes are not picked up.
		renderToolbar();
		const sidebar = mountAgentSidebar({ open: true });

		await importToolbar();
		await tick();

		const toolbar = document.getElementById('extendify-toolbar');
		expect(toolbar.classList.contains('ext-tb-agent-open')).toBe(false);

		sidebar.setAttribute('inert', '');
		await tick();
		sidebar.removeAttribute('inert');
		await tick();

		expect(toolbar.classList.contains('ext-tb-agent-open')).toBe(false);
	});
});
