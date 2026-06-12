// Soft-selection exclusivity.
//
// When Ask AI stages a block, the page does NOT go exclusive:
//   - html.extendify-agent-locked does NOT get set
//   - other tagged blocks do NOT dim
//   - hover bar IS still suppressed on other tagged blocks (so the user
//     can't accidentally re-pick a neighbour mid-conversation)
//   - hover bar is ALSO suppressed on the staged block itself; only
//     DOMHighlighter's X-close is shown. To re-engage Ask AI, click
//     X-close (clears the stage) then re-hover / re-click.
//   - outside-click clears the staged block WITHOUT closing the sidebar
//
// The earlier "lock + page-dim + outside-click closes sidebar" contract
// was reverted after user testing.

import { expect, test } from '../../fixtures';

const STAGED_TARGET = 'Locked target heading.';
const OTHER_TARGET = 'Other tagged heading.';

const heading = (page, text: string) =>
	page.locator('h2.wp-block-heading', { hasText: text });

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

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

const askAiOn = async (page, text: string) => {
	const target = heading(page, text);
	await target.hover();
	await hoverBar(page)
		.getByRole('button', { name: /Ask AI/ })
		.click();
	await expect(agentPanel(page)).toBeVisible();
	return target;
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('staging a block does NOT add the agent-locked html class', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	// Wait for the QE bundle by polling for the hover bar to mount on a
	// hover, rather than gating on admin-bar visibility (which paints
	// before the bundle hydrates and proved a noisy signal in CI).
	await page.waitForFunction(
		() =>
			!!document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, STAGED_TARGET);

	const html = page.locator('html');
	await expect(html).not.toHaveClass(/extendify-agent-locked/);

	const staged = heading(page, STAGED_TARGET);
	await expect(staged).not.toHaveAttribute(
		'data-extendify-agent-locked-target',
		'',
	);
});

test('other tagged blocks do NOT dim while a block is staged', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	// Wait for the QE bundle by polling for the hover bar to mount on a
	// hover, rather than gating on admin-bar visibility (which paints
	// before the bundle hydrates and proved a noisy signal in CI).
	await page.waitForFunction(
		() =>
			!!document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, STAGED_TARGET);

	const other = heading(page, OTHER_TARGET);
	const staged = heading(page, STAGED_TARGET);

	// Both at full opacity — no page-dim under soft selection.
	await expect(other).toHaveCSS('opacity', '1');
	await expect(staged).toHaveCSS('opacity', '1');
});

test('hover bar does NOT render on other tagged blocks while staged', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	// Wait for the QE bundle by polling for the hover bar to mount on a
	// hover, rather than gating on admin-bar visibility (which paints
	// before the bundle hydrates and proved a noisy signal in CI).
	await page.waitForFunction(
		() =>
			!!document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, STAGED_TARGET);

	// Hover suppression is now JS-only (hover-bar.js#onMouseOver). No CSS
	// pointer-events gate to fight, so the natural hover works.
	const other = heading(page, OTHER_TARGET);
	await other.hover();

	await expect(hoverBar(page)).toHaveCount(0);
});

test('outside-click clears the staged block but leaves the sidebar open', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	// Wait for the QE bundle by polling for the hover bar to mount on a
	// hover, rather than gating on admin-bar visibility (which paints
	// before the bundle hydrates and proved a noisy signal in CI).
	await page.waitForFunction(
		() =>
			!!document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, STAGED_TARGET);
	await expect(xClose(page)).toBeVisible();

	const wsb = page.locator('.wp-site-blocks');
	const box = await wsb.boundingBox();
	if (!box) throw new Error('wp-site-blocks bounding box missing');
	await page.mouse.click(box.x + 5, box.y + box.height - 5);

	// Block clears; sidebar stays. This is the asymmetry the new model
	// preserves (closing the sidebar still clears the block via Agent.jsx;
	// clearing the block does NOT close the sidebar).
	await expect(xClose(page)).toHaveCount(0);
	await expect(agentPanel(page)).toBeVisible();
});

test('the staged block keeps the bar hidden; X-close is the re-engage path', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	// Wait for the QE bundle by polling for the hover bar to mount on a
	// hover, rather than gating on admin-bar visibility (which paints
	// before the bundle hydrates and proved a noisy signal in CI).
	await page.waitForFunction(
		() =>
			!!document.documentElement.classList.contains('extendify-quick-edit-on'),
		{ timeout: 15_000 },
	);
	await closeAgentPanel(page);

	await askAiOn(page, STAGED_TARGET);
	await expect(xClose(page)).toBeVisible();

	// While the block is staged the bar stays torn down even when the user
	// re-hovers the staged block itself — only DOMHighlighter's X-close is
	// shown (af8f7f60 bug #3 removed the "hover staged → re-render bar"
	// carve-out by design call). The outline overlays the heading with
	// pointer-events: auto, so dispatch the mouseover directly on the
	// heading to exercise hover-bar.js#onMouseOver.
	const staged = heading(page, STAGED_TARGET);
	await staged.dispatchEvent('mouseover');
	await expect(hoverBar(page)).toHaveCount(0);

	// X-close clears the stage; only then does re-hovering bring the bar
	// back, so Ask AI can be re-engaged on the same block.
	await xClose(page).click();
	await expect(xClose(page)).toHaveCount(0);
	await staged.dispatchEvent('mouseover');
	await expect(hoverBar(page)).toBeVisible();
});
