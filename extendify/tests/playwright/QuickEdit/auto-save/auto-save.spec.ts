import { expect, test } from '../../fixtures';

// Contract: auto-save on implicit close. While the QE text-edit
// canvas is open, the gestures that close it WITHOUT an explicit Save —
// clicking a different block, or clicking outside any block — must persist
// the in-flight edit rather than discard it. The capture-phase click rule
// in hover-bar.js routes both through save-bridge's saveSelected():
//   - cross-block click → saveSelected({ alsoClear: false }): A saves, the
//     same gesture opens QE on B (alsoClear false so the async save doesn't
//     null out B's freshly-set selection).
//   - click-outside      → saveSelected({ alsoClear: true }): the edit saves
//     and the canvas tears down.
// Esc's discard path (no save) is already pinned by inline-text.spec.ts.

const HEADING_A = 'Heading A for cross-block auto-save.';
const HEADING_A_EDITED = 'Heading A saved by clicking heading B.';
const HEADING_B = 'Heading B is the cross-block target.';
const HEADING_C = 'Heading C for click-outside auto-save.';
const HEADING_C_EDITED = 'Heading C saved by clicking the footer.';

const agentPanel = (page) => page.locator('#extendify-agent-popout-modal');

// The agent sidebar opens on load in this env. With it open, a two-pill
// heading click also silently stages the agent block — close it first so
// the click is a clean QE-open and the implicit-close gestures are the
// only thing under test.
const closeAgentPanel = async (page) => {
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:close')),
	);
	await expect(agentPanel(page)).toHaveCount(0);
};

const editorRichText = (page) =>
	page
		.locator('.extendify-quick-edit-canvas .block-editor-rich-text__editable')
		.first();

// Scope to the LIVE post heading — the canvas renders its own h2 copy, and
// `[data-extendify-agent-block-id]` is only on the page's real blocks.
const liveHeading = (page, text: string) =>
	page.locator('h2.wp-block-heading[data-extendify-agent-block-id]', {
		hasText: text,
	});

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const markPageForReloadDetection = async (page) => {
	await page.evaluate(() => {
		(window as unknown as { __qeNoReload: boolean }).__qeNoReload = true;
	});
};

const pageDidNotReload = async (page) =>
	page.evaluate(
		() =>
			(window as unknown as { __qeNoReload?: boolean }).__qeNoReload === true,
	);

const saveResponse = (page) =>
	page.waitForResponse(
		(r) => r.url().includes('/quick-edit/save') && r.status() === 200,
	);

// tabindex=0 is the readiness gate: it confirms the Quick Edit bundle
// mounted and decorated the live block before the spec clicks it.
const openCanvasOn = async (page, text: string) => {
	const block = liveHeading(page, text);
	await expect(block).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await block.click();
	const editor = editorRichText(page);
	await expect(editor).toBeVisible();
	await expect(editor).toBeFocused();
	return editor;
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('clicking a different block auto-saves the in-flight edit and opens Quick Edit on the new block', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await closeAgentPanel(page);
	await markPageForReloadDetection(page);

	const editor = await openCanvasOn(page, HEADING_A);
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially(HEADING_A_EDITED);

	const saved = saveResponse(page);
	await liveHeading(page, HEADING_B).click();
	await saved;

	// A persisted in place (no Save click), and the same gesture re-pointed
	// the canvas at B.
	await expect(liveHeading(page, HEADING_A_EDITED)).toBeVisible();
	await expect(editorRichText(page)).toContainText(HEADING_B);
	expect(await pageDidNotReload(page)).toBe(true);
});

test('clicking outside any block auto-saves the in-flight edit and tears down the canvas', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');
	await closeAgentPanel(page);
	await markPageForReloadDetection(page);

	const editor = await openCanvasOn(page, HEADING_C);
	await editor.press('ControlOrMeta+a');
	await editor.pressSequentially(HEADING_C_EDITED);

	const saved = saveResponse(page);
	await page.locator('footer').first().click();
	await saved;

	await expect(page.locator('.extendify-quick-edit-canvas')).not.toBeVisible();
	await expect(liveHeading(page, HEADING_C_EDITED)).toBeVisible();
	expect(await pageDidNotReload(page)).toBe(true);
});
