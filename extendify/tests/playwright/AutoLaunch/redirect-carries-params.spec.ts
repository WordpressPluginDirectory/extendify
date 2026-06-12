import { expect, test } from '../fixtures';

// JetHost regression (company-product#2246): a useAgentOnboarding partner deep
// links a logged-out user to ?page=extendify-launch with site params. On the
// first admin visit (extendify_launch_loaded unset), redirectOnce bounces them
// to auto-launch — and used to drop every param but `page`.
//
// We assert window.extLaunchData.urlParams, not the URL: url-params.js strips
// the params from the browser URL on mount by design, so they only survive in
// that global (localized from $_GET by Admin.php::getURLParams). No `go` param,
// so the build orchestrator never starts.

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
	// redirectOnce is once-per-install: mounting LaunchPage sets
	// extendify_launch_loaded, which short-circuits the bounce on the next
	// visit. Playwright reuses one wp-playground server across retries, so a
	// retry would land on extendify-launch and fail for the wrong reason.
	// Clear the guard so every attempt starts from the documented precondition.
	await requestUtils.rest({
		path: '/extendify/v1/auto-launch/options',
		method: 'POST',
		data: { option: 'extendify_launch_loaded', value: '' },
	});
});

test('deep-link params survive the launch → auto-launch bounce', async ({
	page,
	admin,
}) => {
	await admin.visitAdminPage(
		'admin.php',
		[
			'page=extendify-launch',
			'objective=sell-products',
			'title=Acme Test Co',
			'structure=multi-page',
			'tone=friendly',
		].join('&'),
	);

	await expect(page).toHaveURL(/admin\.php\?page=extendify-auto-launch/);

	const urlParams = await page.evaluate(() => window.extLaunchData?.urlParams);

	expect(urlParams).toMatchObject({
		objective: 'sell-products',
		title: 'Acme Test Co',
		structure: 'multi-page',
		tone: ['friendly'],
	});
});
