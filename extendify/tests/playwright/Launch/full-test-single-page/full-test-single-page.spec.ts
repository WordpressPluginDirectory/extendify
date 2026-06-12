// e2e:disabled
import { expect, test } from '../../fixtures';
import {
	goalsStub,
	homeTemplatesStub,
	imagesStub,
	siteProfileStub,
	siteStringsStub,
	stylesStub,
} from '../_mocks';

// Heaviest spec in the Launch suite — drives the full single-page flow end to
// end: objective → site-info → site-prep → site-structure → content-gathering
// → home-select → CreatingSite orchestrator → redirect to Assist with the
// success marker. The orchestrator installs plugins, creates pages, processes
// patterns, replaces placeholders, and updates template parts; only the
// content-shaping AI/Patterns/Images calls are stubbed.
// Memory-ceiling risk: if this flakes intermittently, leave it on Cypress.

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();

	// 6 content stubs from `_mocks.ts` + the insights stub (mirrors Cypress's
	// `cy.disableInsights()` — silences the bursty per-state-change POSTs to
	// the real insights backend). Everything else (site-plugins, generate-logo,
	// patterns, link-pages, process-placeholders, wp/v2/* writes, plugin
	// install) hits real APIs by design — same posture as the Cypress spec.
	await page.route('**/api/site-profile', (route) =>
		route.fulfill({ status: 200, json: siteProfileStub }),
	);
	await page.route('**/api/site-strings', (route) =>
		route.fulfill({ status: 200, json: siteStringsStub }),
	);
	await page.route('**/api/styles', (route) =>
		route.fulfill({ status: 200, json: stylesStub }),
	);
	await page.route('**/api/home-templates*', (route) =>
		route.fulfill({ status: 200, json: homeTemplatesStub }),
	);
	await page.route('**/api/search*', (route) =>
		route.fulfill({ status: 200, json: imagesStub }),
	);
	await page.route('**/launch/goals*', (route) =>
		route.fulfill({ status: 200, json: goalsStub }),
	);
	await page.route('**/insights.extendify.com/api/v1/launch*', (route) =>
		route.fulfill({ status: 200, json: [] }),
	);

	await admin.visitAdminPage('admin.php', 'page=extendify-launch');
});

test('builds a single-page site and lands on Assist with the success marker', async ({
	page,
}) => {
	// Orchestrator runs real plugin installs, AI pattern generation, and
	// wp/v2/* writes — well past Playwright's default 30s test budget.
	test.setTimeout(180_000);

	// Objective: clicking auto-advances after a 5ms timeout (see
	// ObjectiveSelection.handleClick) — no next-button click needed here.
	await expect(
		page.getByRole('heading', {
			name: /What type of website are you creating/i,
		}),
	).toBeVisible();
	await expect(page.getByTestId('next-button')).toBeDisabled();
	await page.getByTestId('site-template-type-business').click();

	// Site Information: 1s debounce before state.ready flips — wait for the
	// next-button to enable rather than racing the debounce.
	await expect(
		page.getByRole('heading', { name: /Tell Us About Your Website/i }),
	).toBeVisible();
	await page.getByTestId('site-title-input').fill('My new site');
	await page.getByTestId('site-info-input').fill('My new site description');
	await expect(page.getByTestId('next-button')).toBeEnabled();
	await page.getByTestId('next-button').click();

	// SitePrep loading screen — auto-advances 1s after site-plugins resolves.
	// `getSitePlugins` falls back to `[]` on failure, so a real-API miss won't
	// stall the flow.
	await expect(
		page.getByRole('heading', { name: /Customizing Your Experience/i }),
	).toBeVisible();

	// Site Structure: pick single-page. Click does NOT auto-advance here
	// (unlike Objective), so the next-button click is required.
	await expect(
		page.getByRole('heading', { name: /Pick Your Site Structure/i }),
	).toBeVisible();
	const structureCards = page.getByTestId('site-template-type');
	await expect(structureCards).toHaveCount(2);
	await page.getByText('Single-Page Website').click();
	await expect(page.getByTestId('next-button')).toBeEnabled();
	await page.getByTestId('next-button').click();

	// ContentGathering loading screen — auto-advances 1s after homeLayouts
	// resolves (stubbed).
	await expect(
		page.getByRole('heading', { name: /Designing Your Options/i }),
	).toBeVisible();

	// Home selection — pick the first layout preview.
	await expect(
		page.getByRole('heading', { name: /Pick a design for your website/i }),
	).toBeVisible();
	const previews = page.getByTestId('layout-preview');
	await expect(previews).toHaveCount(homeTemplatesStub.length);
	await previews.first().click();
	await expect(page.getByTestId('next-button')).toBeEnabled();
	await page.getByTestId('next-button').click();

	// Orchestrator runs (plugin installs, page creation, template part writes,
	// pattern processing). Default redirect lands on the Assist admin page
	// with the success marker — generous timeout to accommodate the real-API
	// work the orchestrator does.
	await page.waitForURL(/page=extendify-assist.*extendify-launch-success/, {
		timeout: 120_000,
	});
	await expect(page.locator('body')).toContainText('Site Guide', {
		timeout: 30_000,
	});
});
