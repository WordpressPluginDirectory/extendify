import { expect, test } from '../../fixtures';

// keyboard-entry.js adds tabindex="0" to every tagged block for
// accessibility, so a mouse click moves focus to the clicked block; under
// Chrome's :focus-visible heuristic the default 1px blue outline paints
// on focused headings (no role="button") and persists after the QE
// committed selection clears via click-outside or Esc. The hover bar's
// showBar (focusin + mouseover) already paints a dashed outline as the
// visual focus indicator, so the browser ring is redundant. quick-edit.
// css suppresses :focus / :focus-visible on tagged blocks while edit
// mode is on; this spec pins that.

const hoverBar = (page) => page.locator('.extendify-quick-edit-bar');
const agentPanel = (page) => page.locator('#extendify-agent-popout-modal');

// While a canvas is open it mounts a fresh BlockEditor that renders its own
// h2.wp-block-heading / p.wp-block-paragraph, so a bare tag locator becomes
// two-element mid-test. Scope to the live tagged block — TagBlocks adds
// data-extendify-agent-block-id only to rendered post content, never the
// canvas editor (and never the theme's <main>).
const liveHeading = (page) =>
	page.locator('h2.wp-block-heading[data-extendify-agent-block-id]', {
		hasText: 'Sticky selection heading',
	});
const liveParagraph = (page) =>
	page.locator('p.wp-block-paragraph[data-extendify-agent-block-id]', {
		hasText: 'A paragraph below the heading',
	});

// The agent sidebar opens on load in this env; with it open, clicking a
// two-pill block also stages the agent, and Esc then clears that stage
// before the QE canvas. Close it so the canvas/Esc flow is what the test
// drives.
const closeAgentPanel = async (page) => {
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:close')),
	);
	await expect(agentPanel(page)).toHaveCount(0);
};

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const outlineStyleOf = (locator) =>
	locator.evaluate((el) => getComputedStyle(el).outlineStyle);

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('clicking a tagged block then pressing Esc leaves no focus outline on the block (Flow B)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const heading = liveHeading(page);
	await expect(heading).toBeVisible();
	await expect(heading).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await closeAgentPanel(page);

	// Two-pill heading click opens QE directly.
	await heading.click();
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
	expect(await outlineStyleOf(heading)).toBe('none');

	await page.keyboard.press('Escape');
	await expect(page.locator('.extendify-quick-edit-canvas')).toHaveCount(0);
	expect(await outlineStyleOf(heading)).toBe('none');
});

test('clicking a tagged block then clicking another tagged block leaves no focus outline on either (Flow A)', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const heading = liveHeading(page);
	const paragraph = liveParagraph(page);
	await expect(heading).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await closeAgentPanel(page);

	await heading.click();
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
	expect(await outlineStyleOf(heading)).toBe('none');

	await paragraph.click();
	// Two-pill click on a different block switches QE to it.
	await expect(page.locator('.extendify-quick-edit-canvas')).toBeVisible();
	expect(await outlineStyleOf(heading)).toBe('none');
	expect(await outlineStyleOf(paragraph)).toBe('none');
});

// Sanity — suppressing :focus-visible on tagged blocks must not break the
// dashed-outline focus indicator that surfaces on focusin
// (keyboard-entry.js#onFocusIn → showBar).
test('keyboard focus on a tagged block still surfaces the dashed outline', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	const heading = liveHeading(page);
	await heading.focus();
	await expect(
		page.locator('.extendify-quick-edit-hover-outline.is-visible'),
	).toBeVisible();
	await expect(hoverBar(page)).toBeVisible();
	expect(await outlineStyleOf(heading)).toBe('none');
});
