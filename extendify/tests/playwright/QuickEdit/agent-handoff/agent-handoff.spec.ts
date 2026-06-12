import { expect, test } from '../../fixtures';

// Characterization: the Ask AI handoff from QE's hover bar into the
// Agent sidebar. The pill calls askAiAboutElement, which
// writes the selected block straight into the unified useQuickEditStore
// (agentBlock) and opens the panel before the agent has any work to do —
// the contracts pinned here are the observable side-effects of that
// single call, plus the ineligibility gate and the cross-block-click
// transition that re-stages agentBlock on a new click.
//
// Selector-side regression guards (scroll tracking, sidebar
// open/close smoothing, X-close click) live in Agent/selector-ux.spec.ts
// — separate WP env, single concern.

const HEADING_1 = 'First heading for Ask AI handoff.';
const HEADING_2 = 'Second heading for selection lock.';

// The Simple Toolbar replaces the WP admin bar on the live front end (it hides
// #wpadminbar), so the old admin-bar toggle never becomes visible. Gate edit-mode
// readiness on the toolbar's #ext-tb-quick-edit switch instead.
const editModeToggle = (page) => page.locator('#ext-tb-quick-edit');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const heading = (page, text: string) =>
	page.locator('h2.wp-block-heading', { hasText: text });

const agentPanel = (page) => page.locator('#extendify-agent-popout-modal');

// The visible signal that a block is "agent-selected" via Ask AI is the
// X-close indicator DOMHighlighter portals on top of the block.
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

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('Ask AI on an eligible heading opens the sidebar and selects the block', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentPanel(page);

	const target = heading(page, HEADING_1);
	await expect(target).toBeVisible();
	const expectedBlockId = await target.getAttribute(
		'data-extendify-agent-block-id',
	);
	expect(expectedBlockId).toBeTruthy();

	await target.hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await bar.getByRole('button', { name: /Ask AI/ }).click();

	await expect(agentPanel(page)).toBeVisible();
	await expect(xClose(page)).toBeVisible();
	const textarea = page.locator('#extendify-agent-chat-textarea');
	await expect(textarea).toBeVisible();
	await expect(textarea).toBeFocused();
	await expect(textarea).toHaveValue('');
});

test('hovering a wp-block-spacer in Edit mode does not surface any hover bar', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	const spacer = page.locator('.wp-block-spacer').first();
	await expect(spacer).toBeAttached();
	await spacer.scrollIntoViewIfNeeded();
	// The spacer is visually empty; dispatch the DOM event so the
	// hover-bar listener fires regardless of Playwright's actionability.
	await spacer.dispatchEvent('mouseover');

	await expect(hoverBar(page)).toHaveCount(0);
});

test('hovering a wp-block-post-title in Edit mode does not surface Ask AI', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });

	const title = page.locator('.wp-block-post-title').first();
	await expect(title).toBeVisible();
	await title.dispatchEvent('mouseover');

	// Post title is not in the QE schemas registry, so the bar has
	// nothing to render and never mounts.
	await expect(hoverBar(page)).toHaveCount(0);
});

test('with the sidebar open and Edit mode on, the highlighter mode class is applied', async ({
	page,
}) => {
	// DOMHighlighter mounts inside the agent panel whenever an
	// agent-eligible block workflow is available. Its `enabled` effect
	// adds `extendify-agent-highlighter-mode` to .wp-site-blocks while
	// mounted — the cheapest observable that the always-on selector is
	// wired up.
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await expect(agentPanel(page)).toBeVisible();

	await expect(page.locator('.wp-site-blocks')).toHaveClass(
		/extendify-agent-highlighter-mode/,
	);
});

test('two-pill click with the agent sidebar open opens QE on the same block AND keeps the canvas usable', async ({
	page,
}) => {
	// Chris's contract:
	//   - Agent open + click a two-pill block → QE canvas opens AND agent
	//     stages on the same block (so the user can chat about it).
	//   - The QE canvas must remain usable — text-selection clicks on the
	//     rich-text editable inside the canvas reach the editable, not the
	//     DOMHighlighter overlay above it.
	//   - A single Esc unwinds both slots (no double-Esc to fully exit).
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await expect(agentPanel(page)).toBeVisible();

	const target = heading(page, HEADING_1);
	await expect(target).toBeVisible();

	await target.click();

	// Two-pill cell with agent open: both `selected` (canvas) and
	// `agentBlock` (highlighter overlay) get set in one click.
	// The canvas host stays visibility:hidden until BlockTextEditor's reveal
	// poll matches the editable to the live text, and the editable only mounts
	// after an async getBlockSource GET — both can outrun the 5s default on a
	// starved runner. Give the reveal room before the actionability click below.
	const canvas = page.locator('.extendify-quick-edit-canvas');
	await expect(canvas).toBeVisible({ timeout: 15_000 });
	const editable = page.locator(
		'.extendify-quick-edit-canvas .block-editor-rich-text__editable',
	);
	await expect(editable).toBeVisible({ timeout: 15_000 });

	// Re-click on the canvas's editable. Pre-fix: DOMHighlighter's outline
	// (z-index ordering puts the body-level agent mount above wp-site-blocks)
	// has `pointer-events: auto` and eats this click; Playwright's
	// actionability check would error. Post-fix: pointer-events drops to
	// 'none' for the same-block case so the editable receives the click.
	await editable.click();
	await expect(editable).toBeFocused();

	// Single Esc clears BOTH `selected` (canvas) and `agentBlock`. Pre-fix:
	// required two presses — one to clear agentBlock, one for the canvas —
	// leaving the dashed outline up after the first Esc.
	await page.keyboard.press('Escape');
	await expect(canvas).toHaveCount(0);
	const stillStaged = await page.evaluate(
		() =>
			document.querySelectorAll('#extendify-agent-dom-mount [aria-hidden]')
				.length,
	);
	expect(stillStaged).toBe(0);
});

test('clicking another tagged block while staged transitions QE + agent to the new block', async ({
	page,
}) => {
	// Previously the cross-block click cleared agentBlock
	// and returned, leaving the user stuck on the prior selection. The
	// new contract: the cross-block click clears the stale stage AND
	// runs the standard click table against the new block in the same
	// gesture. For a two-pill heading with the sidebar already open,
	// that opens QE on the new block AND re-stages agentBlock so the
	// X-close indicator follows.
	await enableEditMode(page);
	await page.goto('/');
	await expect(editModeToggle(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentPanel(page);

	const first = heading(page, HEADING_1);
	const second = heading(page, HEADING_2);
	await expect(first).toBeVisible();
	await expect(second).toBeVisible();
	const firstId = await first.getAttribute('data-extendify-agent-block-id');
	const secondId = await second.getAttribute('data-extendify-agent-block-id');
	expect(firstId).toBeTruthy();
	expect(secondId).toBeTruthy();
	expect(firstId).not.toBe(secondId);

	await first.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Ask AI/ })
		.click();
	const close = xClose(page);
	await expect(close).toBeVisible({ timeout: 15_000 });
	const beforeTop = await close.evaluate((el) => (el as HTMLElement).style.top);
	expect(beforeTop).toBeTruthy();

	await second.click({ force: true });

	// QE canvas mounts on the new block — proves the click also ran the
	// two-pill cell of decideClickAction, not just cleared the stage.
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible({
		timeout: 15_000,
	});

	// The cross-block click opened QE on the new block, so the agent X-close
	// is suppressed by design while a canvas is mounted (quick-edit.css
	// `html:has(.extendify-quick-edit-canvas) … div[role="button"]`). The
	// re-stage still happened: the indicator re-measured onto the new block,
	// so its inline `top` moved — same hidden-not-absent contract as
	// Agent/selector-ux test 6.
	await expect(close).toBeHidden();
	await expect
		.poll(async () => close.evaluate((el) => (el as HTMLElement).style.top))
		.not.toBe(beforeTop);
});
