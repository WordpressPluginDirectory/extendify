// The showSimpleToolbar × showQuickEdit gate matrix.
//
// This blueprint (Toolbar/gating/blueprint.json) ships with NEITHER flag set,
// so it is the off/off corner of the matrix and the canonical home for the
// preview-URL escape hatch. The Agent (and with it the Ask-AI selector bundle)
// is force-loaded on every blueprint via the TRAIN-BUILD OVERRIDE, so
// `#extendify-agent-sidebar` is the "page has settled" anchor here just like
// the sibling gating specs.
//
// `Config::handlePreviewUrlOptIn` is additive and PERSISTS to
// `extendify_enable_preview_features_v1` — a preview key, once opted into, stays
// on for the rest of this server's life. There is no per-test reset, so this
// file runs serial and walks the matrix monotonically: off/off → off/on →
// on/on. The baseline test must run first, on the fresh blueprint boot, before
// any opt-in persists. (CI boots a clean server per project; locally, reboot
// the playground between full re-runs so the baseline sees a clean option.)
//
// Coverage of all four cells across the suite:
//   off / off  → this spec (baseline) + Toolbar/gating/absent-when-off
//   off / on   → this spec (?extendify-preview=quick-edit)
//   on  / off  → Toolbar/quick-edit-gating (partner-flag driven)
//   on  / on   → this spec (both previews) + the 22 QuickEdit partner-flag specs

import { expect, test } from '../../fixtures';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('off/off: WP admin bar only — no toolbar, no Edit-mode toggle, Ask AI intact', async ({
	page,
}) => {
	await page.goto('/');
	await page.waitForSelector('#extendify-agent-sidebar', { timeout: 15_000 });

	// Simple toolbar gate closed, so WordPress keeps its own admin bar...
	await expect(page.locator('#wpadminbar')).toBeVisible();
	await expect(page.locator('#extendify-toolbar')).toHaveCount(0);
	// ...and Quick Edit is off, so the admin-bar Edit-mode toggle never
	// registers. Ask AI rides the agent (anchored above), unaffected.
	await expect(
		page.locator('#wp-admin-bar-extendify-quick-edit-toggle'),
	).toHaveCount(0);
});

test('off/on: ?extendify-preview=quick-edit adds the admin-bar Edit-mode toggle, still no toolbar', async ({
	page,
}) => {
	await page.goto('/?extendify-preview=quick-edit');
	await page.waitForSelector('#extendify-agent-sidebar', { timeout: 15_000 });

	// Quick Edit opts in via the preview key; the simple toolbar stays off,
	// so the toggle surfaces in the still-visible core admin bar.
	await expect(page.locator('#wpadminbar')).toBeVisible();
	await expect(page.locator('#extendify-toolbar')).toHaveCount(0);
	await expect(
		page.locator('#wp-admin-bar-extendify-quick-edit-toggle'),
	).toBeVisible();
});

test('on/on: both preview keys render the simple toolbar with its Edit-mode button', async ({
	page,
}) => {
	await page.goto(
		'/?extendify-preview[]=quick-edit&extendify-preview[]=simple-toolbar',
	);
	await page.waitForSelector('#extendify-agent-sidebar', { timeout: 15_000 });

	// Both gates open: the simple toolbar replaces the core admin bar and
	// carries both the AI Agent and the Quick Edit (Edit-mode) buttons.
	await expect(page.locator('#extendify-toolbar')).toBeVisible();
	await expect(page.locator('#ext-tb-ai-agent')).toBeVisible();
	await expect(page.locator('#ext-tb-quick-edit')).toBeVisible();
});
