import { expect, test } from '../../fixtures';

// Contract: capture-phase click rule on the live front end.
// - Anchor click → browser navigates (no selection, no preventDefault).
// - Click on a tagged block's non-link content → outline commits; no nav.
// - Click on a form control → control focuses (search input).
// - Click outside any tagged block → hover bar / outline clears.
// - Edit mode survives the navigation triggered by an anchor click.

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');
const hoverOutline = (page) =>
	page.locator('.extendify-quick-edit-hover-outline.is-visible');
const agentPanel = (page) => page.locator('#extendify-agent-popout-modal');

// The Ask-AI-only sticky-commit fixture is the container group, not its
// contents. Two pieces of WP-latest behavior shape how we drive it:
//   1. The extendable theme's page wrapper is itself <main class="wp-block-group">,
//      and TagBlocks now tags nested blocks too — so the group's inner
//      paragraph carries its own block-id and is quick-editable. Scope to
//      `div.wp-block-group[data-extendify-agent-block-id]` (excludes the <main>
//      wrapper and the inner <p>) and dispatch the click on the group element
//      itself: a coordinate click lands on the inner paragraph and opens the QE
//      canvas instead of committing the container.
//   2. The agent sidebar opens on load in this env; the committedSelection
//      sticky bar only fires for an Ask-AI-only block while the sidebar is
//      closed (open → the click stages the agent and hides the bar). Close it
//      first via closeAgentPanel.
const askAiOnlyGroup = (page) =>
	page.locator('div.wp-block-group[data-extendify-agent-block-id]', {
		hasText: 'Inside the Ask-AI-only group.',
	});

const closeAgentPanel = async (page) => {
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:close')),
	);
	await expect(agentPanel(page)).toHaveCount(0);
};

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('clicking an inline anchor navigates and keeps edit mode persisted', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const link = page.getByRole('link', { name: 'inline About link' });
	await expect(link).toBeVisible();
	await link.click();

	await expect(page).toHaveURL(/\/about\/?$/);
	await expect(
		page.getByRole('heading', { name: 'About page reached.' }),
	).toBeVisible();
	await expect(page.locator('html')).toHaveClass(/extendify-quick-edit-on/);
});

test('clicking non-link text inside a tagged paragraph opens Quick Edit without navigating', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const startUrl = page.url();
	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'A second paragraph with no link',
	});
	await expect(paragraph).toBeVisible();
	await paragraph.click();

	// Two-pill paragraph click opens QE directly.
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
	expect(page.url()).toBe(startUrl);
});

test('clicking the search input focuses it without committing a selection', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const search = page.getByRole('searchbox');
	await expect(search).toBeVisible();
	await search.click();
	await expect(search).toBeFocused();
});

test('clicking outside any tagged block clears the hover bar', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	// Commit the Ask-AI-only container so the sticky bar renders (no QE pill);
	// see askAiOnlyGroup / closeAgentPanel for why we close the sidebar and
	// dispatch on the group element.
	const group = askAiOnlyGroup(page);
	await expect(group).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await closeAgentPanel(page);
	await group.dispatchEvent('click');
	await expect(hoverBar(page)).toBeVisible();

	await page.locator('footer').first().click();
	await expect(hoverBar(page)).toHaveCount(0);
});

// Click-to-commit contract — see hover-bar.js committedSelection. A click
// on an Ask-AI-only block (the one surviving sticky-commit case)
// pins the bar/outline to the clicked block; hover on other tagged blocks
// is suppressed. Pinned outlines mean exactly one outline is visible at a
// time (also covers the lingering thin outline).
test('click commits the selection on an Ask-AI-only block; hover on other blocks does not move the bar', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const a = askAiOnlyGroup(page);
	await expect(a).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await closeAgentPanel(page);
	const b = page.locator('p.wp-block-paragraph', {
		hasText: 'inline About link',
	});

	await a.dispatchEvent('click');
	await expect(hoverBar(page)).toBeVisible();
	await expect(hoverOutline(page)).toHaveCount(1);

	await b.hover();
	await expect(hoverOutline(page)).toHaveCount(1);
	await expect(hoverBar(page)).toBeVisible();
});

// "Click block A, hover block B" used
// to leave a thin solid outline on A while a second dashed outline drew
// around B. The sticky-click contract gives the click a defined
// visual: exactly one outline overlay at all times, pinned to the
// committed block. This test pins that invariant so a regression that
// re-introduces a second outline (focus-visible, theme CSS, stale
// DOMHighlighter) fails here.
test('exactly one outline overlay exists at all times, pinned to the committed block', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const a = askAiOnlyGroup(page);
	await expect(a).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await closeAgentPanel(page);
	const b = page.locator('p.wp-block-paragraph', {
		hasText: 'inline About link',
	});

	const aBox = await a.boundingBox();
	expect(aBox).not.toBeNull();

	await a.dispatchEvent('click');
	await expect(hoverOutline(page)).toHaveCount(1);
	const afterClickBox = await hoverOutline(page).boundingBox();
	expect(afterClickBox?.x).toBeCloseTo(aBox?.x ?? 0, 0);
	expect(afterClickBox?.y).toBeCloseTo(aBox?.y ?? 0, 0);

	await b.hover();
	await expect(hoverOutline(page)).toHaveCount(1);
	const afterHoverBox = await hoverOutline(page).boundingBox();
	expect(afterHoverBox?.x).toBeCloseTo(aBox?.x ?? 0, 0);
	expect(afterHoverBox?.y).toBeCloseTo(aBox?.y ?? 0, 0);
});

// Regression: cursor traversing from a hovered block UP to
// the pill (through the bar's ::before hover bridge) used to clear the
// bar because renderBar() ran clearBar() before checking whether the
// new candidate target had any pills to render — when the gap landed
// on an unsupported tagged ancestor, the bar disappeared mid-gesture.
// Fix bails BEFORE clearing the old bar. This test pins the contract
// so future "pointer-events: none on the bar" attempts (an earlier one
// existed for pill-scroll) don't re-introduce the symptom.
test('cursor moving from a hovered block up to the pill keeps the bar visible', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'A second paragraph with no link',
	});
	await expect(paragraph).toBeVisible();
	await paragraph.hover();
	await expect(hoverBar(page)).toBeVisible();

	const pill = hoverBar(page).getByRole('button', { name: /Quick Edit/ });
	await expect(pill).toBeVisible();

	const paragraphBox = await paragraph.boundingBox();
	const pillBox = await pill.boundingBox();
	if (!paragraphBox || !pillBox) throw new Error('no bounding boxes');

	// Step the cursor along the same x — paragraph top edge → midpoint of
	// the gap → bridge → pill center. Each step crosses an element boundary
	// (block → page background → bar → pill); the bar should survive every
	// hand-off.
	const px = paragraphBox.x + paragraphBox.width / 2;
	const py = paragraphBox.y + 4;
	await page.mouse.move(px, py);
	await expect(hoverBar(page)).toBeVisible();

	const gapMidY = (pillBox.y + pillBox.height + paragraphBox.y) / 2;
	await page.mouse.move(px, gapMidY);
	await expect(hoverBar(page)).toBeVisible();

	await page.mouse.move(
		pillBox.x + pillBox.width / 2,
		pillBox.y + pillBox.height / 2,
	);
	await expect(hoverBar(page)).toBeVisible();
});

// Pressing Esc on the QE canvas used to leave the hover bar
// hidden until the user moved the cursor onto a different block (mouseover
// only fires on element-boundary crossings, so same-block re-entry was a
// dead spot). The fix force-renders the bar in the `selected` → null
// subscriber. This test cuts off the cursor at the canvas mount and asserts
// the bar comes back on Esc without any cursor movement.
test('pressing Esc on the QE canvas re-renders the hover bar on the same block', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const p = page.locator('p.wp-block-paragraph', {
		hasText: 'A second paragraph with no link',
	});

	// Two-pill click opens QE directly. No pill click step.
	await p.click();
	const canvas = page.locator('.extendify-quick-edit-canvas');
	await expect(canvas).toBeVisible();
	await expect(hoverBar(page)).toHaveCount(0);

	await page.mouse.move(5, 5);
	await page.keyboard.press('Escape');

	await expect(canvas).toHaveCount(0);
	await expect(hoverBar(page)).toBeVisible();
});

// Ask AI lives on the QE chrome (right side of
// Cancel / Save) for two-pill blocks. The hover bar's Ask AI pill is
// still available; the chrome button is the in-canvas escape hatch.
test('two-pill click opens QE directly, and the QE chrome surfaces an Ask AI button', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'A second paragraph with no link',
	});

	await paragraph.click();
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
	await expect(hoverBar(page)).toHaveCount(0);

	await expect(page.locator('[data-test="quick-edit-ask-ai"]')).toBeVisible();
});

test('click on a different Ask-AI-only block while committed commits the new one in one gesture', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	// Two Ask-AI-only commits are awkward in this seed (only one group).
	// Pin the swap shape on the surviving sticky case: group commit → click
	// another tagged block (two-pill paragraph) → group commit clears AND
	// the new click opens QE on the paragraph in one gesture.
	const group = askAiOnlyGroup(page);
	await expect(group).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await closeAgentPanel(page);
	const paragraph = page.locator('p.wp-block-paragraph', {
		hasText: 'A second paragraph with no link',
	});

	await group.dispatchEvent('click');
	await expect(hoverBar(page)).toBeVisible();
	await expect(hoverOutline(page)).toHaveCount(1);

	await paragraph.click();
	// Two-pill click opens QE directly; the prior commit clears.
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
	await expect(hoverBar(page)).toHaveCount(0);
});
