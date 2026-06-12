import { expect, test } from '../../fixtures';

// Characterization: the four agent regression guards that require
// docked-left sidebar mode — the
// `useAgentOnboarding` partner-config flag flips the agent layout
// from floating to sidebar and turns wp-site-blocks into the page
// scroller. Each test pins the user-observable side of one fix.
//
// In scope (sidebar mode):
//   - 3c81021c  selection rect tracks the element when ancestors
//               scroll (wp-site-blocks is the scroll container).
//   - 34e3ce9f  cleanup auto-scroll skipped while sidebar is closing.
//   - e25af945  sidebar smoothing + scroll preservation on close.
//   - 33cc9c1f  wp.media modal/backdrop offsets past the agent
//               sidebar via :has() — CSS-only, observable only here.

const TOP_HEADING = 'Top heading.';

const sidebar = (page) => page.locator('#extendify-agent-sidebar');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const heading = (page, text: string) =>
	page.locator('h2.wp-block-heading', { hasText: text });

const xClose = (page) =>
	page.locator('#extendify-agent-dom-mount div[role="button"]');

const sidebarCloseButton = (page) =>
	sidebar(page).getByRole('button', { name: /Close window/ });

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const askAiOn = async (page, text: string) => {
	const target = heading(page, text);
	await target.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Ask AI/ })
		.click();
	await expect(xClose(page)).toBeVisible();
	return target;
};

const waitForSidebarMode = async (page) => {
	await expect(sidebar(page)).toBeVisible({ timeout: 15_000 });
	// useLayoutShift turns wp-site-blocks into the page scroller (overflow-y:
	// auto + a transform) once the panel finishes opening.
	await expect
		.poll(async () =>
			page.evaluate(() => {
				const wsb = document.querySelector('.wp-site-blocks') as HTMLElement;
				return wsb ? getComputedStyle(wsb).overflowY : null;
			}),
		)
		.toBe('auto');
};

// useAgentOnboarding auto-injects `changeSiteDesignWorkflow` + its whenFinished
// component (SelectSiteVibes) when `extAgentData.chatHistory.length === 0`.
// Two side effects bleed into the scroll guards: `workflow?.id` makes
// Agent.jsx's `busy` truthy (suppressing DOMHighlighter's X-close), and
// SelectSiteVibes's onLoad effect calls scrollIntoView on the chat-scroll-area
// when its data fetch settles — which would mask the 34e3ce9f spy. Patch the
// chatHistory array as `extAgentData` is assigned to skip the auto-injection.
const skipOnboardingAutoInject = async (page) => {
	await page.addInitScript(() => {
		let _ext: unknown;
		Object.defineProperty(window, 'extAgentData', {
			configurable: true,
			get: () => _ext,
			set: (v) => {
				if (v && typeof v === 'object') {
					(v as { chatHistory: unknown[] }).chatHistory = [
						{ id: 'seed', type: 'noop', details: {} },
					];
				}
				_ext = v;
			},
		});
	});
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('selection rect tracks the heading when wp-site-blocks scrolls (3c81021c)', async ({
	page,
}) => {
	await skipOnboardingAutoInject(page);
	await enableEditMode(page);
	await page.goto('/');
	await waitForSidebarMode(page);

	await askAiOn(page, TOP_HEADING);
	const close = xClose(page);
	const beforeTop = await close.evaluate((el) => (el as HTMLElement).style.top);

	// Scroll the ancestor (wp-site-blocks). bubble-phase `scroll` doesn't
	// propagate from a non-window scroller, so without `{capture: true}` on
	// the window scroll listener the rect would freeze at beforeTop.
	await page.evaluate(() => {
		const wsb = document.querySelector('.wp-site-blocks') as HTMLElement;
		wsb.scrollTop = 600;
	});

	await expect
		.poll(async () => close.evaluate((el) => (el as HTMLElement).style.top))
		.not.toBe(beforeTop);

	const beforeTopNum = Number.parseFloat(beforeTop);
	const afterTopNum = Number.parseFloat(
		await close.evaluate((el) => (el as HTMLElement).style.top),
	);
	expect(afterTopNum).toBeLessThan(beforeTopNum);
});

test('cleanup() skips chat scrollIntoView when open is false (34e3ce9f guard)', async ({
	page,
}) => {
	await skipOnboardingAutoInject(page);
	await page.goto('/');
	await waitForSidebarMode(page);

	// Close the sidebar first so global-store `open` is false in the live
	// store. SidebarLayout unmounts its children at this point, so orthogonal
	// scrollIntoView paths inside ChatMessages can't fire against the spy.
	await sidebarCloseButton(page).click();
	await expect(sidebar(page)).toHaveAttribute('inert', '');

	// Spy then dispatch cancel-workflow. cleanup() runs with `open===false`;
	// the 34e3ce9f guard returns before the chat-scroll-area scrollIntoView.
	await page.evaluate(() => {
		(window as unknown as { __chatScrollCalls: number }).__chatScrollCalls = 0;
		const original = Element.prototype.scrollIntoView;
		Element.prototype.scrollIntoView = function patched(...args: unknown[]) {
			if (this.closest('#extendify-agent-chat-scroll-area')) {
				(
					window as unknown as { __chatScrollCalls: number }
				).__chatScrollCalls += 1;
			}
			return original.apply(this, args as Parameters<typeof original>);
		};
		window.dispatchEvent(new CustomEvent('extendify-agent:cancel-workflow'));
	});

	// Yield a frame so any deferred work the cleanup-listener might queue
	// (e.g. rAF-scheduled scroll restoration) settles before the assertion.
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
	);

	const calls = await page.evaluate(
		() =>
			(window as unknown as { __chatScrollCalls: number }).__chatScrollCalls,
	);
	expect(calls).toBe(0);
});

test('closing on a scrolled page restores window.scrollY instantly (e25af945)', async ({
	page,
}) => {
	await skipOnboardingAutoInject(page);
	await page.goto('/');
	await waitForSidebarMode(page);

	// Scroll wp-site-blocks (the active scroller while the panel is open) to
	// a known offset — that's the value the close branch should hand back to
	// window.scrollY after tearing down the wsb-as-scroller setup.
	await page.evaluate(() => {
		const wsb = document.querySelector('.wp-site-blocks') as HTMLElement;
		wsb.scrollTop = 500;
	});

	await sidebarCloseButton(page).click();
	await expect(sidebar(page)).toHaveAttribute('inert', '');

	// After close, body's `position: fixed` is gone and the page is back to
	// window-scroll. `behavior: 'instant'` overrides any inherited
	// `html { scroll-behavior: smooth }` so this should land immediately.
	await expect
		.poll(async () => page.evaluate(() => Math.round(window.scrollY)))
		.toBeGreaterThan(300);
});

test('wp.media modal offsets past the agent sidebar via :has() (33cc9c1f)', async ({
	page,
}) => {
	await skipOnboardingAutoInject(page);
	await page.goto('/');
	await waitForSidebarMode(page);

	// The CSS rule lives in src/QuickEdit/quick-edit.css — the QuickEdit
	// bundle loads on the frontend whenever Agent does. Inject synthetic
	// wp.media nodes and read computed styles; the :has() selector matches
	// on the live sidebar's `inert` state.
	await page.evaluate(() => {
		const backdrop = document.createElement('div');
		backdrop.className = 'media-modal-backdrop';
		backdrop.id = 'qe-media-backdrop-sentinel';
		backdrop.style.position = 'fixed';
		document.body.appendChild(backdrop);

		const modal = document.createElement('div');
		modal.className = 'media-modal';
		modal.id = 'qe-media-modal-sentinel';
		modal.style.position = 'fixed';
		document.body.appendChild(modal);
	});

	const backdrop = page.locator('#qe-media-backdrop-sentinel');
	const modal = page.locator('#qe-media-modal-sentinel');
	await expect(backdrop).toHaveCSS('left', '384px');
	await expect(modal).toHaveCSS('left', '414px');

	await sidebarCloseButton(page).click();
	await expect(sidebar(page)).toHaveAttribute('inert', '');
	await expect(backdrop).not.toHaveCSS('left', '384px');
	await expect(modal).not.toHaveCSS('left', '414px');
});
