import { expect, test } from '../../fixtures';

// Issue 21.2 (#2191): with the standard admin bar (showSimpleToolbar off),
// the PHP-registered Quick Edit toggle must end up immediately after the
// JS-injected AI Agent button — mirroring the simple toolbar's order —
// instead of stranded in the left cluster.

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('the Quick Edit toggle is the next sibling of the AI Agent button', async ({
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
});
