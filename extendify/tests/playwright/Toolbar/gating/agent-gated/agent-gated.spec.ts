// The simple toolbar's headline "AI Agent" button does nothing on its own —
// it drives the Agent's mounted admin-bar button at click time. So a toolbar
// without the Agent loaded is a toolbar with a dead button, which is exactly
// what we don't want to ship. Bootstrap therefore gates the toolbar on the
// Agent load, not just `showSimpleToolbar`.
//
// This blueprint has `showSimpleToolbar` ON but the Agent gate CLOSED
// (`showAIAgents` off — a non-extendable theme or a pre-Launch site would
// close it just the same). Pre-fix, bootstrap rendered the toolbar anyway and
// its AI Agent button sat permanently disabled ("AI Agent unavailable"). Now
// the toolbar must be absent and WordPress keeps its own admin bar.

import { expect, test } from '../../../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('simple toolbar is absent when the AI Agent gate is closed, even with showSimpleToolbar on', async ({
	page,
}) => {
	await page.goto('/');
	// No Agent on this blueprint, so there's no agent sidebar to anchor on.
	// The core admin bar is the settle signal — and its presence is half the
	// assertion: with the toolbar gated out, nothing hides it.
	await page.waitForSelector('#wpadminbar', { timeout: 15_000 });

	await expect(page.locator('#extendify-toolbar')).toHaveCount(0);
	await expect(page.locator('#wpadminbar')).toBeVisible();
});
