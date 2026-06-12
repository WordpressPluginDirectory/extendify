// The simple Extendify toolbar is gated on `showSimpleToolbar`. With the flag
// off (this blueprint), bootstrap never constructs ToolbarFrontend, so the
// server-rendered `#extendify-toolbar` node is absent and WordPress keeps its
// own admin bar. Agent stays on (showAIAgents) — proof the gate is
// toolbar-specific, not a blanket front-end disable.

import { expect, test } from '../../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('simple toolbar is absent when showSimpleToolbar is off', async ({
	page,
}) => {
	await page.goto('/');
	// Agent boots on this blueprint — anchor on it so the page has settled
	// before asserting the toolbar's absence.
	await page.waitForSelector('#extendify-agent-sidebar', { timeout: 15_000 });

	await expect(page.locator('#extendify-toolbar')).toHaveCount(0);
	await expect(page.locator('#wpadminbar')).toBeVisible();
});
