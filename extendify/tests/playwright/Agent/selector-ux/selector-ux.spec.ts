import { expect, test } from '../../fixtures';

// Characterization: the post-merge regression guards for the agent
// selector tool. Each test pins the user-observable side of
// one fix at the Agent ↔ Quick Edit boundary.
//
// In scope (floating mode — the default agentPosition):
//   - 0999a1fa  Ask AI sets a block + mounts the X-close; closing the
//               sidebar clears the latent block.
//   - Soft selection — outside-click clears the staged block but does
//               NOT close the sidebar (supersedes the earlier "close
//               sidebar" behavior, which user testing concluded was too
//               aggressive).
//   - 1d27ca3d  X-close click clears the block.
//   - 6e94e6fd  X-close hides via CSS while a QE canvas is in the DOM.
//   - 6bf9ea6a  Selector tool suspends (no new pick) while a QE canvas
//               is in the DOM.
//
// Not in this spec (require docked-left sidebar mode — `useAgentOnboarding`
// partner-config flag flips the agent layout from floating to sidebar
// and turns wp-site-blocks into the page scroller, which is what each
// of the four scroll-related fixes hardens):
//   - 3c81021c  scroll-rect tracks element on ancestor (wp-site-blocks)
//               scroll.
//   - 34e3ce9f  cleanup auto-scroll skipped while sidebar is closing.
//   - e25af945  sidebar smoothing + scroll preservation on open/close.
//   - 33cc9c1f  wp.media modal/backdrop offset past the agent sidebar.
// Those want their own onboarding-mode blueprint; deferred to a follow-up
// spec rather than expanding this one's surface area.

const HEADING_A = 'Selector target heading.';
const HEADING_B = 'Outside click target heading.';
const HEADING_C = 'QE canvas heading.';

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const heading = (page, text: string) =>
	page.locator('h2.wp-block-heading', { hasText: text });

const agentPanel = (page) => page.locator('#extendify-agent-popout-modal');

const xClose = (page) =>
	page.locator('#extendify-agent-dom-mount div[role="button"]');

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const closeAgentPanel = async (page) => {
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:close')),
	);
	await expect(agentPanel(page)).toHaveCount(0);
};

// askAiAboutElement writes `agentBlock` straight into useQuickEditStore
// and opens the panel. The user-observable signal that a block is now
// "agent-selected" is the X-close indicator DOMHighlighter portals on
// top of the block.
const askAiOn = async (page, text: string) => {
	const target = heading(page, text);
	await target.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Ask AI/ })
		.click();
	await expect(xClose(page)).toBeVisible();
	return target;
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Ask AI mounts the X-close indicator (0999a1fa first half)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await page.waitForFunction(
		() =>
			document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, HEADING_A);

	await expect(xClose(page)).toBeVisible();
});

test('closing the sidebar clears the agent block (0999a1fa second half)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await page.waitForFunction(
		() =>
			document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, HEADING_A);

	await closeAgentPanel(page);

	// Block clears in the store via the open=false effect in Agent.jsx; the
	// X-close (gated on both panel-open and block-set) tears down with it.
	await expect(xClose(page)).toHaveCount(0);
});

test('clicking the X-close clears the agent block (1d27ca3d)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await page.waitForFunction(
		() =>
			document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, HEADING_A);
	const close = xClose(page);

	await close.click();

	await expect(close).toHaveCount(0);
});

test('clicking outside the staged block clears it but leaves the sidebar open', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await page.waitForFunction(
		() =>
			document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, HEADING_A);
	await expect(xClose(page)).toBeVisible();

	// Soft selection: outside-click clears the staged block directly
	// without touching the sidebar. The earlier
	// "close sidebar → cascade to clear-block" path is gone.
	const wsb = page.locator('.wp-site-blocks');
	const box = await wsb.boundingBox();
	if (!box) throw new Error('wp-site-blocks bounding box missing');
	await page.mouse.click(box.x + 5, box.y + box.height - 5);

	await expect(xClose(page)).toHaveCount(0);
	await expect(agentPanel(page)).toBeVisible();
});

test('the X-close hides via CSS while a Quick Edit canvas is mounted (6e94e6fd)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await page.waitForFunction(
		() =>
			document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, HEADING_A);
	const close = xClose(page);

	// Baseline: X-close renders via Tailwind's `.extendify-agent .flex`
	// (in @layer utilities, !important) — computed display is `flex`.
	await expect(close).toBeVisible();
	await expect(close).toHaveCSS('display', 'flex');

	// hover-bar's `hasAgentBlockSelected()` page-wide gate suppresses real
	// QE entry while an agent block is selected, so drive the CSS contract
	// via a sentinel canvas. The QE bundle's layered hide rule fires the
	// moment `.extendify-quick-edit-canvas` exists in the DOM.
	await page.evaluate(() => {
		const sentinel = document.createElement('div');
		sentinel.className = 'extendify-quick-edit-canvas';
		sentinel.id = 'qe-canvas-sentinel';
		document.body.appendChild(sentinel);
	});

	await expect(close).toBeHidden();
});

test('clicking another tagged block while a Quick Edit canvas is mounted keeps the agent X-close suppressed (6e94e6fd)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await page.waitForFunction(
		() =>
			document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await expect(agentPanel(page)).toBeVisible();

	// Real QE canvas via the hover bar — no agent block selected yet,
	// so the hover bar is not suppressed.
	const editTarget = heading(page, HEADING_C);
	await editTarget.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Quick Edit/ })
		.click();
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();

	// Option-7 bridge: clicking another both-pills block while editing swaps QE
	// onto it and (sidebar open) stages it for the agent — but 6e94e6fd's
	// `:has(.extendify-quick-edit-canvas)` rule keeps the agent X-close
	// display:none the whole time a canvas is mounted, so the user never sees
	// two selection UIs at once (6bf9ea6a's complaint, now solved by hiding the
	// indicator rather than suppressing the stage).
	const other = heading(page, HEADING_B);
	await other.click({ force: true });

	await expect(xClose(page)).toBeHidden();
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
});
