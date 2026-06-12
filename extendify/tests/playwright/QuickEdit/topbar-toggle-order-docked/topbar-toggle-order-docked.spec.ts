import { expect, test } from '../../fixtures';

// Issue 21.2 (#2191), onboarding variant: with `useAgentOnboarding` on, the
// frontend agent is docked-left and its admin-bar button anchors before the
// WP logo (far left). The Quick Edit toggle must still land immediately
// after it — kossmann's screenshot shows this mode, not floating.

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('the toggle follows the AI Agent button when the agent is docked', async ({
	page,
}) => {
	await page.goto('/');
	await expect(
		page.locator('#wp-admin-bar-extendify-quick-edit-toggle'),
	).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('#wp-admin-bar-extendify-agent-btn')).toBeVisible({
		timeout: 15_000,
	});

	// The two <li>s are injected/moved by separate bundles on domReady, so
	// poll DOM order rather than asserting a single snapshot.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.getElementById('wp-admin-bar-extendify-agent-btn')
						?.nextElementSibling?.id,
			),
		)
		.toBe('wp-admin-bar-extendify-quick-edit-toggle');

	// Pin the docked anchor too — the pair leads the bar, before the WP logo.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.getElementById('wp-admin-bar-extendify-quick-edit-toggle')
						?.nextElementSibling?.id,
			),
		)
		.toBe('wp-admin-bar-wp-logo');
});
