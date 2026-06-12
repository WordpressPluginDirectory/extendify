// Quick Edit is gated on the showQuickEdit partner flag,
// independently of the simple toolbar. This blueprint (inherited from
// Toolbar/blueprint.json) has showSimpleToolbar ON and showQuickEdit OFF,
// so the toolbar renders WITHOUT its Edit-mode toggle, and the selector's
// Quick Edit pill never surfaces — but the agent's Ask AI pill is
// unaffected (it rides on the same selector bundle).

import { expect, test } from '../../fixtures';

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

test('simple toolbar omits the Edit-mode button when showQuickEdit is off', async ({
	page,
}) => {
	await page.goto('/');
	// Agent boots on this blueprint — anchor on it so the page has settled.
	await page.waitForSelector('#extendify-agent-sidebar', { timeout: 15_000 });

	await expect(page.locator('#extendify-toolbar')).toBeVisible();
	await expect(page.locator('#ext-tb-ai-agent')).toBeVisible();
	await expect(page.locator('#ext-tb-quick-edit')).toHaveCount(0);
});

test('Ask AI pill still surfaces with QE off; the Quick Edit pill does not', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await page.waitForSelector('#extendify-agent-sidebar', { timeout: 15_000 });

	const paragraph = page
		.locator('p', { hasText: 'Toolbar test page.' })
		.first();
	await expect(paragraph).toBeVisible();
	await paragraph.hover();

	const bar = page.locator('.extendify-quick-edit-bar');
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: /Ask AI/ })).toBeVisible();
	await expect(bar.getByRole('button', { name: /Quick Edit/ })).toHaveCount(0);
});
