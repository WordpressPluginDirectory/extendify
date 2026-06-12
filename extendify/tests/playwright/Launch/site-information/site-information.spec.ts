// e2e:disabled
import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures';

const launchUrl = 'page=extendify-launch&extendify-preview=launch-questions';

type SelectionState = {
	siteInformation?: { title?: string };
	businessInformation?: { description?: string };
};

// The user-selections store POSTs the entire store state as a JSON string in
// `state`. Wait for the specific debounced POST whose inner state contains
// the new field value — mirrors Cypress's intercept + alias-on-body-match.
const waitForSelectionsPost = (
	page: Page,
	predicate: (state: SelectionState) => boolean,
) =>
	page.waitForResponse((res) => {
		if (!res.url().includes('/extendify/v1/shared/user-selections-data'))
			return false;
		if (res.request().method() !== 'POST') return false;
		if (res.status() !== 200) return false;
		const post = res.request().postDataJSON();
		if (!post?.state) return false;
		try {
			const parsed = JSON.parse(post.state) as { state?: SelectionState };
			return predicate(parsed?.state ?? {});
		} catch {
			return false;
		}
	});

// Tests are intentionally serial: each one mutates `extendify_user_selections`
// via the product. Blueprint seeds both title + description; tests 1 and 2
// each assert their default before overwriting it. Tests 3-5 clear the title
// input so they don't depend on prior state.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ requestUtils, admin }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', launchUrl);
});

test('updates the site title', async ({ page }) => {
	const title = page.getByTestId('site-title-input');
	await expect(title).toHaveValue('default title');

	const post = waitForSelectionsPost(
		page,
		(state) => state.siteInformation?.title === 'My new site',
	);
	await title.fill('My new site');
	await post;

	await page.reload();
	await expect(title).toHaveValue('My new site');
});

test('updates the site description', async ({ page }) => {
	const description = page.getByTestId('site-info-input');
	await expect(description).toHaveValue('default description');

	const post = waitForSelectionsPost(
		page,
		(state) =>
			state.businessInformation?.description === 'My new site description',
	);
	await description.fill('My new site description');
	await description.blur();
	await post;

	await page.reload();
	await expect(description).toHaveValue('My new site description');
});

test("can't move to next page without a title", async ({ page }) => {
	await expect(
		page.getByRole('heading', { name: /Tell Us About Your Website/i }),
	).toBeVisible();
	await page.getByTestId('site-title-input').fill('');
	await expect(page.getByTestId('next-button')).toBeDisabled();
});

test("can't move to next page with a description only", async ({ page }) => {
	await expect(
		page.getByRole('heading', { name: /Tell Us About Your Website/i }),
	).toBeVisible();
	await page.getByTestId('site-title-input').fill('');
	await page.getByTestId('site-info-input').fill('My new site description');
	await expect(page.getByTestId('next-button')).toBeDisabled();
});

test('can move to next page with a title', async ({ page }) => {
	await expect(
		page.getByRole('heading', { name: /Tell Us About Your Website/i }),
	).toBeVisible();
	await page.getByTestId('site-title-input').fill('');
	await page.getByTestId('site-title-input').fill('My new site');
	await expect(page.getByTestId('next-button')).toBeEnabled();
});
