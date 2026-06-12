// The toolbar's AI Agent button
// is hidden via CSS while the agent sidebar is open, but was never removed
// from the tab order. `toolbar.js` now sets `inert` on the button when the
// sidebar opens, restoring it on close.

import { expect, test } from '../../fixtures';

const aiBtn = (page) => page.locator('#ext-tb-ai-agent');
const agentSidebar = (page) => page.locator('#extendify-agent-sidebar');

const openSidebar = (page) =>
	page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:open')),
	);

const closeSidebar = (page) =>
	page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:close')),
	);

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('AI button is inert while the agent sidebar is open, restored on close', async ({
	page,
}) => {
	await page.goto('/');
	await expect(aiBtn(page)).toBeVisible({ timeout: 15_000 });
	await page.waitForSelector('#extendify-agent-sidebar', { timeout: 15_000 });

	// The agent store defaults to open — start from a known closed state.
	await closeSidebar(page);
	await expect(agentSidebar(page)).toHaveAttribute('inert');
	await expect(aiBtn(page)).not.toHaveAttribute('inert');

	// Open the sidebar — button must be removed from tab order.
	await openSidebar(page);
	await expect(agentSidebar(page)).not.toHaveAttribute('inert');
	await expect(aiBtn(page)).toHaveAttribute('inert');

	// Close the sidebar — button must be restored to tab order.
	await closeSidebar(page);
	await expect(agentSidebar(page)).toHaveAttribute('inert');
	await expect(aiBtn(page)).not.toHaveAttribute('inert');
});
