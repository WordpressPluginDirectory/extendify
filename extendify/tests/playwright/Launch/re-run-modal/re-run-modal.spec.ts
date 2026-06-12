// e2e:disabled
import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures';

const oldPagesText =
	'3 pages/posts created in the prior onboarding session will be deleted';

// `page.request` (not `requestUtils.rest`) — requestUtils caches its REST
// rootURL into artifacts/storage-states/admin.json across runs, so it sends
// requests to whichever playground port wrote the cache first.
const countTestPages = async (page: Page) => {
	const res = await page.request.get('/wp-json/wp/v2/pages', {
		params: { per_page: 100, status: 'publish' },
	});
	const pages = (await res.json()) as Array<{ title: { rendered: string } }>;
	return pages.filter((p) => p.title.rendered === 'test page').length;
};

// Continue test deletes the seeded pages, so run exit first.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ requestUtils, admin }) => {
	await requestUtils.login();
	await admin.visitAdminPage('admin.php', 'page=extendify-launch');
});

test('redirect to Assist when clicking exit', async ({ page }) => {
	await expect(page.getByText(oldPagesText)).toBeVisible();

	await page.getByTestId('modal-exit-button').click();
	await expect(page).toHaveURL(/admin\.php\?page=extendify-assist/);
	expect(await countTestPages(page)).toBe(3);
});

test('hides when clicking continue', async ({ page }) => {
	await expect(page.getByText(oldPagesText)).toBeVisible();

	await page.getByTestId('modal-continue-button').click();
	await expect(page.getByText(oldPagesText)).toBeHidden({ timeout: 30_000 });
	expect(await countTestPages(page)).toBe(0);
});
