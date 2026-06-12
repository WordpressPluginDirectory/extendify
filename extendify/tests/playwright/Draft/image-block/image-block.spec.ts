import { expect, test } from '../../fixtures';

test.beforeEach(async ({ admin, editor, page, requestUtils }) => {
	await requestUtils.login();
	await admin.visitAdminPage('post-new.php', 'post_type=page');
	// Wait for the Draft sidebar toggle so we know our scripts have booted.
	await expect(
		page.locator('button[aria-controls="extendify-draft:draft"]').first(),
	).toBeVisible({ timeout: 15_000 });
	await editor.insertBlock({ name: 'core/image' });
});

const generateImageWrapper = '.components-form-file-generate-image';
const searchUnsplashWrapper = '.components-form-file-search-unsplash';

test('image placeholder shows two buttons', async ({ editor }) => {
	const generate = editor.canvas.locator(`${generateImageWrapper} button`);
	const unsplash = editor.canvas.locator(`${searchUnsplashWrapper} button`);

	await expect(generate).toBeVisible();
	await expect(generate).toHaveText('Generate Image');
	await expect(unsplash).toBeVisible();
	await expect(unsplash).toHaveText('Search Unsplash');

	// The single combined button is gone.
	await expect(
		editor.canvas.getByRole('button', { name: 'Get Personalized Image' }),
	).toHaveCount(0);

	// Each wrapper holds exactly one button — they are not nested together.
	await expect(
		editor.canvas.locator(`${generateImageWrapper} button`),
	).toHaveCount(1);
	await expect(
		editor.canvas.locator(`${searchUnsplashWrapper} button`),
	).toHaveCount(1);
});

test('"Generate Image" opens the sidebar directly on the AI image generator', async ({
	editor,
	page,
}) => {
	await editor.canvas.locator(`${generateImageWrapper} button`).click();

	// Sidebar opens routed to the AI image page (skipping the Home screen).
	await expect(
		page.getByRole('heading', { name: 'AI Image Generator' }),
	).toBeVisible();
	await expect(page.locator('#draft-ai-image-textarea')).toBeVisible();
});

test('"Search Unsplash" opens the sidebar directly on the Unsplash search', async ({
	editor,
	page,
}) => {
	await editor.canvas.locator(`${searchUnsplashWrapper} button`).click();

	// Sidebar opens routed to the Unsplash page (skipping the Home screen).
	await expect(
		page.getByRole('heading', { name: 'Photos from Unsplash' }),
	).toBeVisible();
});
