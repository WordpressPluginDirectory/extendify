// Esc clears the staged agent block.
//
// Before the global-escape consolidation, the agent's window-level Esc
// handler in Chat.jsx never fired while edit mode was on: edit-mode.js
// stopPropagation'd Esc at the document bubble phase before it reached
// the window. So pressing Esc on the page body (outside the chat
// textarea) silently did nothing.
//
// After the consolidation, one global document-level handler (wireGlobalEscape)
// owns the priority order: agent block → clear it + cancel workflow,
// QE selection → clear it, else → noop. This spec pins the agent-block
// branch.

import { expect, test } from '../../fixtures';

const HEADING_TEXT = 'Esc target heading.';

const adminBarPill = (page) =>
	page.locator('#wp-admin-bar-extendify-quick-edit-toggle a');

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const heading = (page) =>
	page.locator('h2.wp-block-heading', { hasText: HEADING_TEXT });

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

const askAi = async (page) => {
	const target = heading(page);
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

test('Esc on the page body clears the staged agent block', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentPanel(page);

	await askAi(page);

	// Move focus off the chat textarea — the repro was "Esc
	// only fires when chat sidebar has focus." Click the body and
	// press Esc from there.
	await page.locator('body').click({ position: { x: 5, y: 5 } });
	await page.keyboard.press('Escape');

	// Soft-selection (4d5d64b8) dropped the exclusive `extendify-agent-locked`
	// html class; the staged block's only signal is the X-close indicator,
	// which Esc tears down.
	await expect(xClose(page)).toHaveCount(0);
});

test('Esc with no staged block does not flip edit mode off', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await expect(adminBarPill(page)).toBeVisible({ timeout: 15_000 });
	await closeAgentPanel(page);

	const html = page.locator('html');
	await expect(html).toHaveClass(/extendify-quick-edit-on/);

	await page.locator('body').click({ position: { x: 5, y: 5 } });
	await page.keyboard.press('Escape');

	// The plan's locked priority order makes Esc a noop when nothing
	// is selected — edit mode stays on so the user can keep editing.
	await expect(html).toHaveClass(/extendify-quick-edit-on/);
});
