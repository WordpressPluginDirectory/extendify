import { expect, test } from '../../fixtures';

// Characterization: the four picker paths off the image hover menu plus
// the AI flow's save-500 failure mode. The picker is anchored
// to a core/image block via the same hover-bar that the text flow exercises
// for text; here we drive the picker dropdown (Library / Upload /
// Generate with AI / Search Unsplash) and the modals it mounts.
//
// The wp.media flows (Library + Upload) only assert that the WP media
// frame opens and QE tags it with the mode class — driving the wp.media
// UI to select an attachment is the WP runtime's responsibility, not
// Quick Edit's. The AI + Unsplash flows mock the external image endpoints
// (`ai.extendify.com` is unreachable in playground) and force the
// importImage canvas path to fail, so the modal exercises its
// importImageServer fallback — that's the path that hits the WP API
// surface we actually own. Then /quick-edit/save runs for real and
// returns the rendered HTML the splice pins back into the DOM.

const MOCK_AI_IMAGE_URL = 'https://mock-extendify-images.invalid/ai.png';
const MOCK_UNSPLASH_IMAGE_URL = 'https://mock-extendify-images.invalid/u.png';

// 1x1 transparent PNG — enough for canvas.toBlob to produce a non-null
// blob so importImage's apiFetch reaches /wp/v2/media (which we mock).
const ONE_PIXEL_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
	'base64',
);

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');

const imageBlock = (page) => page.locator('figure.wp-block-image').first();

const pickerMenu = (page) =>
	page.locator('#extendify-quick-edit-image-menu[role="menu"]');

// Edit mode is seeded via localStorage; gate on the image block being
// decorated (tabindex=0) to confirm the Quick Edit bundle mounted. The old
// admin-bar toggle can't be the readiness signal — the Simple Toolbar
// replaces the core admin bar on this branch, so #wpadminbar is hidden.
const editModeReady = (page) =>
	expect(imageBlock(page)).toHaveAttribute('tabindex', '0', {
		timeout: 15_000,
	});

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

// Serve a real PNG for the AI/Unsplash preview URLs so `new Image()`
// loads, the canvas is untainted, and canvas.toBlob produces a real
// blob — importImage then POSTs to /wp/v2/media (mocked separately).
// CORS header is required: importImage sets `crossOrigin = 'anonymous'`,
// and without ACAO the canvas taints and toBlob returns null.
const servePngForMockImages = async (page) => {
	const fulfill = (route) =>
		route.fulfill({
			status: 200,
			contentType: 'image/png',
			headers: { 'Access-Control-Allow-Origin': '*' },
			body: ONE_PIXEL_PNG,
		});
	await page.route(MOCK_AI_IMAGE_URL, fulfill);
	await page.route(MOCK_UNSPLASH_IMAGE_URL, fulfill);
};

const mockWpMediaUpload = async (page, mediaUrl: string) => {
	await page.route('**/wp/v2/media*', (route, request) => {
		if (request.method() !== 'POST') return route.fallback();
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				id: 999,
				source_url: mediaUrl,
			}),
		});
	});
};

const mockGenerateImage = async (page) => {
	await page.route('**/api/draft/image', (route, request) => {
		if (request.method() !== 'POST') return route.fallback();
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([{ url: MOCK_AI_IMAGE_URL }]),
			headers: {
				'x-ratelimit-remaining': '9',
				'x-ratelimit-limit': '10',
				'x-ratelimit-reset': '0',
				'x-request-id': 'mock-ai-1',
			},
		});
	});
};

const mockUnsplashSearch = async (page) => {
	await page.route('**/api/draft/image/unsplash*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([
				{
					id: 'mock-u-1',
					alt_description: 'mock unsplash image',
					urls: {
						small: MOCK_UNSPLASH_IMAGE_URL,
						regular: MOCK_UNSPLASH_IMAGE_URL,
					},
					user: {
						name: 'Mock Photographer',
						links: { html: 'https://example.invalid/photographer' },
					},
				},
			]),
			headers: { 'X-Request-Id': 'mock-u-req' },
		}),
	);
	await page.route('**/api/draft/image/download', (route) =>
		route.fulfill({ status: 204, body: '' }),
	);
};

const openPickerMenu = async (page) => {
	await imageBlock(page).hover();
	const bar = hoverBar(page);
	await expect(bar).toBeVisible();
	await bar.getByRole('button', { name: /Quick Edit/ }).click();
	await expect(pickerMenu(page)).toBeVisible();
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('image hover opens the four-item picker menu', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');
	await editModeReady(page);

	await openPickerMenu(page);
	const menu = pickerMenu(page);
	await expect(menu.getByRole('menuitem')).toHaveCount(4);
	await expect(
		menu.getByRole('menuitem', { name: /Pick from media library/ }),
	).toBeVisible();
	await expect(menu.getByRole('menuitem', { name: /^Upload/ })).toBeVisible();
	await expect(
		menu.getByRole('menuitem', { name: /Generate with AI/ }),
	).toBeVisible();
	await expect(
		menu.getByRole('menuitem', { name: /Search for new image/ }),
	).toBeVisible();
});

test('Pick from media library opens the wp.media frame in browse mode', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await editModeReady(page);

	await openPickerMenu(page);
	// Dispatch the click via the DOM element instead of coordinates: the
	// hover bar stays visible for picker-type blocks (image / cover) so
	// the menu can anchor to it, which means the bar's pill sits on top
	// of the first menu item. A coordinate-based click — even with
	// `force: true` — lands on the bar and toggles selection off rather
	// than firing the menu item's onClick.
	await pickerMenu(page)
		.getByRole('menuitem', { name: /Pick from media library/ })
		.dispatchEvent('click');

	await expect(page.locator('.media-modal')).toBeVisible();
	// QE tags the opened frame (frame.modal.$el) with the mode class so its
	// chrome-hiding CSS can't leak into the Agent's media frame — see
	// InlineEditor.jsx. Asserting the tag is what distinguishes browse from
	// upload; it lands on wp.media's classless outer modal wrapper, not on
	// .media-modal, so don't couple the locator to .media-modal and assert the
	// tag is applied rather than that the frame element is visible.
	await expect(
		page.locator('.extendify-quick-edit-mode-browse'),
	).toBeAttached();
});

test("browse mode hides wp.media chrome (router + filters) inside QE's frame", async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await editModeReady(page);

	await openPickerMenu(page);
	await pickerMenu(page)
		.getByRole('menuitem', { name: /Pick from media library/ })
		.dispatchEvent('click');

	await expect(page.locator('.media-modal')).toBeVisible();
	await expect(
		page.locator('.extendify-quick-edit-mode-browse'),
	).toBeAttached();

	// The point of the mode class is the chrome-hiding CSS (quick-edit.css):
	// the frame should be just "pick an image" — no Upload/Library tab router,
	// no attachments-browser filter/search toolbar. The other tests only
	// assert the class is *attached*; this pins that the CSS it gates actually
	// lands. It regressed silently once: the selector was over-qualified
	// (.media-modal.<mode>), but the class sits on wp.media's classless outer
	// modal wrapper — not on .media-modal — so it matched nothing, the chrome
	// leaked, and no test asserted the resulting display state.
	await expect(page.locator('.media-frame-router')).toBeHidden();
	await expect(
		page.locator('.media-frame-content .attachments-browser .media-toolbar'),
	).toBeHidden();
});

test('Upload opens the wp.media frame in upload mode', async ({ page }) => {
	await enableEditMode(page);
	await page.goto('/');
	await editModeReady(page);

	await openPickerMenu(page);
	await pickerMenu(page)
		.getByRole('menuitem', { name: /^Upload/ })
		.click();

	await expect(page.locator('.media-modal')).toBeVisible();
	// See the browse-mode test: the mode tag lands on the classless outer
	// modal wrapper, not on .media-modal.
	await expect(
		page.locator('.extendify-quick-edit-mode-upload'),
	).toBeAttached();
});

test('Generate with AI imports the preview and saves through /quick-edit/save', async ({
	page,
}) => {
	await enableEditMode(page);
	await servePngForMockImages(page);
	await mockGenerateImage(page);
	await mockWpMediaUpload(page, MOCK_AI_IMAGE_URL);
	await page.goto('/');
	await editModeReady(page);

	await openPickerMenu(page);
	await pickerMenu(page)
		.getByRole('menuitem', { name: /Generate with AI/ })
		.click();

	const aiModal = page.locator('.extendify-quick-edit-ai-image');
	await expect(aiModal).toBeVisible();

	await aiModal
		.getByLabel(/Image prompt/i)
		.fill('A mountain at sunrise, painted style');

	const generated = page.waitForResponse(
		(r) => r.url().includes('/api/draft/image') && r.status() === 200,
	);
	await aiModal.getByRole('button', { name: /^Generate$/ }).click();
	await generated;

	await expect(
		aiModal.locator('.extendify-quick-edit-ai-preview img'),
	).toBeVisible();

	const imported = page.waitForResponse(
		(r) => /\/wp\/v2\/media\b/.test(r.url()) && r.request().method() === 'POST',
	);
	const saved = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);
	await aiModal.getByRole('button', { name: /^Use image$/ }).click();
	await imported;
	const savedRes = await saved;

	// Asserting the request body rather than the rendered DOM: WP's
	// wp_filter_content_tags rewrites the <img> when attrs.id points at a
	// non-existent attachment (our mocked id is 999), so the final src in
	// the spliced figure isn't what we sent. The Quick Edit contract is
	// the payload we hand /quick-edit/save; downstream WP rendering is
	// out of scope for this characterization.
	const body = JSON.parse(savedRes.request().postData() || '{}');
	expect(body.patches?.[0]?.value?.url).toBe(MOCK_AI_IMAGE_URL);
	await expect(aiModal).toHaveCount(0);
});

test('Search Unsplash picks a tile and saves through /quick-edit/save', async ({
	page,
}) => {
	await enableEditMode(page);
	await servePngForMockImages(page);
	await mockUnsplashSearch(page);
	await mockWpMediaUpload(page, MOCK_UNSPLASH_IMAGE_URL);
	await page.goto('/');
	await editModeReady(page);

	await openPickerMenu(page);
	await pickerMenu(page)
		.getByRole('menuitem', { name: /Search for new image/ })
		.click();

	const unsplashModal = page.locator('.extendify-quick-edit-image-picker');
	await expect(unsplashModal).toBeVisible();

	const tile = unsplashModal
		.locator('button.extendify-quick-edit-image-grid-item')
		.first();
	await expect(tile).toBeVisible();

	const imported = page.waitForResponse(
		(r) => /\/wp\/v2\/media\b/.test(r.url()) && r.request().method() === 'POST',
	);
	const saved = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);
	await tile.click();
	await imported;
	const savedRes = await saved;

	// Same caveat as the AI flow above — assert the payload, not the
	// rendered DOM, so the test doesn't couple to wp_filter_content_tags.
	const body = JSON.parse(savedRes.request().postData() || '{}');
	expect(body.patches?.[0]?.value?.url).toBe(MOCK_UNSPLASH_IMAGE_URL);
	await expect(unsplashModal).toHaveCount(0);
});

test('save failure surfaces an error notice and keeps the AI modal open', async ({
	page,
}) => {
	await enableEditMode(page);
	await servePngForMockImages(page);
	await mockGenerateImage(page);
	await mockWpMediaUpload(page, MOCK_AI_IMAGE_URL);
	await page.route('**/quick-edit/save', (route) =>
		route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'mock server error' }),
		}),
	);
	await page.goto('/');
	await editModeReady(page);

	await openPickerMenu(page);
	await pickerMenu(page)
		.getByRole('menuitem', { name: /Generate with AI/ })
		.click();

	const aiModal = page.locator('.extendify-quick-edit-ai-image');
	await aiModal.getByLabel(/Image prompt/i).fill('Cliff at dusk');
	const generated = page.waitForResponse(
		(r) => r.url().includes('/api/draft/image') && r.status() === 200,
	);
	await aiModal.getByRole('button', { name: /^Generate$/ }).click();
	await generated;

	const saveFailed = page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 500,
	);
	await aiModal.getByRole('button', { name: /^Use image$/ }).click();
	await saveFailed;

	await expect(aiModal).toBeVisible();
	// The modal's save catch runs the error through friendlyMessage()
	// (src/QuickEdit/lib/errors.js), which generalizes every non-nonce
	// backend error to one copy — so the notice shows the generic string,
	// not the raw `mock server error` body. Same generalization the
	// edge-contracts canvas-error assertion was aligned to in b3c73d0f.
	await expect(aiModal.locator('.components-notice.is-error')).toContainText(
		/Sorry, something went wrong/i,
	);
});
