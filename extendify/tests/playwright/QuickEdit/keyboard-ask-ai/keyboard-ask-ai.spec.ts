import { expect, test } from '../../fixtures';

// "Ask AI" must be keyboard-reachable on Ask-AI-only blocks.
// A top-level group is tagged for the agent but has no Quick Edit modal, so
// before this fix Enter only re-showed the hover bar (which then tore itself
// down before it could be reached) and the block was announced "Edit …".
// This spec pins the two new contracts: the group is announced as an Ask AI
// action, and Enter routes straight into the agent — opening the sidebar and
// staging the block — without any mouse interaction.

const agentPanel = (page) => page.locator('#extendify-agent-popout-modal');

// The visible signal that a block is "agent-selected" via Ask AI is the
// X-close indicator DOMHighlighter portals on top of the block.
const xClose = (page) =>
	page.locator('#extendify-agent-dom-mount div[role="button"]');

// Scope to the tagged instance: the extendable theme's <main> also carries
// `wp-block-group`, but it is template chrome, not a the_content block, so it
// never receives the agent block-id (and is a <main>, not a <div>).
const askAiOnlyGroup = (page) =>
	page.locator('div.wp-block-group[data-extendify-agent-block-id]').first();

const enableEditMode = async (page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'extendify-quick-edit-mode',
			JSON.stringify({ state: { on: true }, version: 0 }),
		);
	});
};

const closeAgentPanel = async (page) => {
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent('extendify-agent:close')),
	);
	await expect(agentPanel(page)).toHaveCount(0);
};

test.beforeEach(async ({ requestUtils }) => {
	await requestUtils.login();
});

test('the Ask-AI-only group is announced as "Ask AI about …"', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	// Waiting for the decoration is the readiness gate: tabindex=0 confirms
	// the Quick Edit bundle mounted and keyboard entry decorated the block.
	const group = askAiOnlyGroup(page);
	await expect(group).toHaveAttribute('tabindex', '0', { timeout: 15_000 });
	await expect(group).toHaveAttribute('aria-label', /^Ask AI about /);
});

test('keyboard Enter on the Ask-AI-only group opens the agent sidebar and stages the block', async ({
	page,
}) => {
	await enableEditMode(page);
	await page.goto('/');

	// tabindex=0 is the readiness gate: it confirms the Quick Edit bundle
	// mounted and keyboard entry decorated the block.
	const group = askAiOnlyGroup(page);
	await expect(group).toHaveAttribute('tabindex', '0', { timeout: 15_000 });

	// The agent panel is open on load in this env; close it so the Enter
	// below is what re-opens it.
	await closeAgentPanel(page);

	await group.focus();
	await page.keyboard.press('Enter');

	await expect(agentPanel(page)).toBeVisible();
	await expect(xClose(page)).toBeVisible();
	const textarea = page.locator('#extendify-agent-chat-textarea');
	await expect(textarea).toBeFocused();
});
