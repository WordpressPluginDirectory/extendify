// The toolbar gate also honors the preview-URL escape hatch:
// `?extendify-preview=simple-toolbar` opts in via `Config::preview()` even
// when the partner flag is off (this blueprint). The opt-in persists on the
// first request, and the gate opens on that same request, so one navigation
// is enough to render the toolbar.

import { expect, test } from '../../fixtures';

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('?extendify-preview=simple-toolbar renders the toolbar when the flag is off', async ({
	page,
}) => {
	await page.goto('/?extendify-preview=simple-toolbar');

	await expect(page.locator('#extendify-toolbar')).toBeVisible({
		timeout: 15_000,
	});
});
