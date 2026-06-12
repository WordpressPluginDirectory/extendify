// e2e:disabled
import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures';

type SelectionState = { siteStructure?: string };

// The user-selections store POSTs the entire store state as a JSON string in
// `state` (300ms debounce). Wait for the specific POST whose inner state
// matches the new siteStructure — same predicate shape used elsewhere, narrower
// field. Reading the option back via REST would need a nonce that page.request
// can't carry; the POST body verifies persistence at the same layer Cypress's
// `cy.getOption` does.
const waitForSiteStructurePost = (page: Page, expected: string) =>
	page.waitForResponse((res) => {
		if (!res.url().includes('/extendify/v1/shared/user-selections-data'))
			return false;
		if (res.request().method() !== 'POST') return false;
		if (res.status() !== 200) return false;
		const post = res.request().postDataJSON();
		if (!post?.state) return false;
		try {
			const parsed = JSON.parse(post.state) as { state?: SelectionState };
			return parsed?.state?.siteStructure === expected;
		} catch {
			return false;
		}
	});

test.beforeEach(async ({ requestUtils, admin, page }) => {
	await requestUtils.login();
	// usePagesStore persists currentPageIndex to localStorage keyed by siteId
	// (`extendify-pages-${siteId}`). Without seeding it the user lands on the
	// objective screen (index 0). Blueprints can't touch localStorage, so
	// addInitScript runs before any page script — no runtime mutation.
	// Cypress equivalent: cy.setLaunchPage('12345', { currentPageIndex: 3, ... }).
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-pages-12345',
			JSON.stringify({
				state: { currentPageIndex: 3, currentPageSlug: 'site-structure' },
				version: 0,
			}),
		);
	});
	await admin.visitAdminPage('admin.php', 'page=extendify-launch');
});

test('renders structure cards and persists the selection', async ({ page }) => {
	await expect(
		page.getByRole('heading', { name: /Pick Your Site Structure/i }),
	).toBeVisible();

	const cards = page.getByTestId('site-template-type');
	await expect(cards).toHaveCount(2);
	// SiteStructure randomizes button order on mount and selects whichever
	// ended up first. Whatever random order won, the first card is checked.
	await expect(cards.first()).toHaveAttribute('aria-checked', 'true');

	const selectedTitle = (
		await cards.last().locator('h1').textContent()
	)?.trim();
	const expected =
		selectedTitle === 'Multi-Page Website' ? 'multi-page' : 'single-page';

	const post = waitForSiteStructurePost(page, expected);
	await cards.last().click();
	await post;

	await expect(cards.first()).not.toHaveAttribute('aria-checked', 'true');
	await expect(cards.last()).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByTestId('next-button')).toBeEnabled();

	await page.reload();
	// On rehydration, the previously selected card moves to the first slot —
	// firstButton's useState seeds from the persisted siteStructure value.
	await expect(cards.first()).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByTestId('next-button')).toBeEnabled();
});
