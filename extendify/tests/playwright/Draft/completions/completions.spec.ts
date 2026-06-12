// e2e:disabled — port of the Cypress spec that's commented out in
// cypress-push.yml's matrix. Mirrors Cypress's "ported but flaky / not run in
// CI" state. Remove this marker to enable.
import { expect, test } from '../../fixtures';

const chatText =
	"In Extendify's realm, where dreams take flight, Code and creativity intertwine with might. Modules and plugins, a universe of wonder, Empowering creators, lightning and thunder.";

test.beforeEach(async ({ admin, page, requestUtils }) => {
	await requestUtils.login();

	await page.route('**/api/draft/completion*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'text/plain',
			body: chatText,
		}),
	);

	await admin.visitAdminPage('post-new.php', 'post_type=page');
	await expect(page.locator('#draft-ai-textarea')).toBeVisible({
		timeout: 15_000,
	});
});

const submitCompletion = async (page: import('@playwright/test').Page) => {
	await page
		.locator('#draft-ai-textarea')
		.fill('Write a small poem about Extendify');
	await page
		.locator('.extendify-draft form')
		.evaluate((form: HTMLFormElement) => form.requestSubmit());
	await page.waitForResponse('**/api/draft/completion*');
};

test('Replace selected block of text', async ({ editor, page }) => {
	await editor.canvas.getByLabel('Add default block').click();
	await page.keyboard.type('Placeholder text');
	await expect(editor.canvas.getByLabel('Block: Paragraph')).toHaveText(
		'Placeholder text',
	);

	await submitCompletion(page);

	await expect(page.locator('.completion')).toBeVisible();
	await page.getByTestId('replace-selected').click();

	await expect(editor.canvas.getByLabel('Block: Paragraph')).toHaveText(
		chatText,
	);
});

test('Insert text at the top', async ({ editor, page }) => {
	await submitCompletion(page);
	await page.getByTestId('insert-top').click();

	await expect(editor.canvas.getByLabel('Block: Paragraph').first()).toHaveText(
		chatText,
	);
});

test('Insert after selected text', async ({ editor, page }) => {
	await editor.canvas.getByLabel('Add default block').click();
	await page.keyboard.type('Placeholder text');
	await editor.canvas.getByLabel('Block: Paragraph').click();

	await submitCompletion(page);
	await page.getByTestId('insert-after').click();

	await expect(editor.canvas.getByLabel('Block: Paragraph').last()).toHaveText(
		chatText,
	);
});

test('Insert text at the bottom', async ({ editor, page }) => {
	await editor.canvas.getByLabel('Add default block').click();
	await page.keyboard.type('Placeholder text');
	await editor.canvas.getByLabel('Block: Paragraph').click();

	await submitCompletion(page);
	await page.getByTestId('insert-bottom').click();

	await expect(editor.canvas.getByLabel('Block: Paragraph').last()).toHaveText(
		chatText,
	);
});

test('Remove selection', async ({ editor, page }) => {
	await editor.canvas.getByLabel('Add default block').click();
	await page.keyboard.type('Placeholder text');
	await editor.canvas.getByLabel('Block: Paragraph').click();

	await page.locator('#draft-ai-textarea').fill('I want to');

	await expect(page.getByTestId('existing-text-container')).toBeVisible();
	await page.getByTestId('remove-selection').click();
	await expect(page.getByTestId('existing-text-container')).toHaveCount(0);
});

test('Try again button', async ({ page }) => {
	await submitCompletion(page);
	const next = page.waitForResponse('**/api/draft/completion*');
	await page.getByTestId('try-again-button').click();
	await next;
});

test('Discard button', async ({ page }) => {
	await submitCompletion(page);
	await expect(page.getByTestId('completion-input')).toBeVisible();
	await page.getByTestId('discard-button').click();
	await expect(page.getByTestId('completion-input')).toHaveCount(0);
});

test('Toolbar AI Button reopens the sidebar', async ({ page }) => {
	await submitCompletion(page);
	await page.getByTestId('insert-top').click();

	await page
		.locator(
			'div.interface-complementary-area-header > button[aria-controls="extendify-draft:draft"]',
		)
		.click();

	await page
		.locator('div[role="toolbar"] .extendify-draft button')
		.first()
		.click();

	const menuItem = page
		.locator('.extendify-draft button[role="menuitem"]')
		.first();
	await expect(menuItem).toBeVisible();
	await menuItem.click();

	await expect(page.locator('#draft-ai-textarea')).toBeVisible();
});

test('Edit button re-runs the completion', async ({ page }) => {
	await submitCompletion(page);
	await page.getByTestId('insert-top').click();

	const menuItem = page
		.locator('.extendify-draft button[role="menuitem"]')
		.first();
	await expect(menuItem).toBeVisible();

	const next = page.waitForResponse('**/api/draft/completion*');
	await menuItem.click();
	await next;
});
