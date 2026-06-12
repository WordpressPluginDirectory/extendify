// Pins the selection-state persistence boundary that the Agent-store merge
// (main removed `workflowHistory`, this branch moved `block` out to
// `useQuickEditStore.agentBlock`) left implicit. Two guarantees, neither
// enforced by a `partialize` anymore:
//
//   1. The QuickEdit selection model is structurally non-persisted — its slots
//      reset on every reload, even with a stale agent-workflows blob sitting in
//      localStorage. (If the store ever gained a `persist` wrapper, this fails.)
//   2. A pre-move workflow blob carrying stale `block` / `workflowHistory`
//      hydrates the live `workflow` slot cleanly, and those dead keys do NOT
//      feed the block-availability path the app actually reads — availability
//      keys off the live (null) `useQuickEditStore.agentBlock`, not the blob.
//
// `@agent/workflows/workflows` uses webpack `require.context`, which doesn't
// exist under Jest, so the registry + the two onboarding theme specs are mocked
// here. `zustand/middleware` is intentionally NOT mocked — the point is to
// exercise the real `persist` hydration + `merge`.

jest.mock('@agent/workflows/workflows', () => ({
	workflows: [
		{ id: 'plain', available: () => true },
		{ id: 'needs-block', available: () => true, requires: ['block'] },
	],
	tools: {},
}));

const themeSpec = {
	__esModule: true,
	default: { example: { agentResponse: { whenFinishedTool: {} } } },
};
jest.mock('@agent/workflows/theme/change-site-design', () => themeSpec);
jest.mock('@agent/workflows/theme/change-theme-variation', () => themeSpec);
jest.mock('@agent/lib/util', () => ({
	isChangeSiteDesignWorkflowAvailable: () => false,
}));

const PERSIST_KEY = 'extendify-agent-workflows-test-site';

// A blob shaped like one written *before* the block→QuickEdit move: it carries
// the live workflow slot plus the now-dead `block` / `blockCode` /
// `workflowHistory` keys that no code reads anymore.
const seedPreMoveBlob = () => {
	localStorage.setItem(
		PERSIST_KEY,
		JSON.stringify({
			version: 0,
			state: {
				workflow: { id: 'needs-block', startingPage: 'https://x.test/' },
				workflowData: null,
				whenFinishedToolProps: null,
				block: { id: 'stale-block', el: {} },
				blockCode: '<p>stale</p>',
				workflowHistory: [{ id: 'old-completed' }],
			},
		}),
	);
};

beforeEach(() => {
	jest.resetModules();
	localStorage.clear();
	window.extAgentData = { chatHistory: [{ role: 'user' }] }; // non-empty → not onboarding
	window.extSharedData = { ...window.extSharedData, siteId: 'test-site' };
});

describe('QuickEdit selection store — non-persisted by construction', () => {
	it('exposes no persist API and starts every selection slot null on reload', async () => {
		const { useQuickEditStore } = await import('@quick-edit/state/store');
		// A `persist()`-wrapped store hangs a `.persist` control API off the
		// hook; a plain `create()` store has none. This is the structural guard
		// that the selection model never gains a persist wrapper.
		expect(useQuickEditStore.persist).toBeUndefined();
		const s = useQuickEditStore.getState();
		expect(s.selected).toBeNull();
		expect(s.agentBlock).toBeNull();
		expect(s.agentBlockCode).toBeNull();
		expect(s.committedSelection).toBeNull();
	});
});

describe('Agent workflow store — pre-move blob hydration', () => {
	it('hydrates the live workflow slot and does not resurrect block/workflowHistory into availability', async () => {
		seedPreMoveBlob();
		const { useWorkflowStore } = await import('@agent/state/workflows');
		const { useQuickEditStore } = await import('@quick-edit/state/store');

		// The live slot hydrates from the blob.
		expect(useWorkflowStore.getState().workflow).toMatchObject({
			id: 'needs-block',
		});

		// The stale persisted `block` did not leak into the slot the app reads.
		expect(useQuickEditStore.getState().agentBlock).toBeNull();

		// Block-availability keys off the live (null) QuickEdit block, NOT the
		// stale persisted one — so a block-gated workflow stays excluded.
		expect(
			useWorkflowStore
				.getState()
				.getAvailableWorkflows()
				.map((w) => w.id),
		).toEqual(['plain']);

		// Control: a *live* agentBlock flips availability, proving the source of
		// truth is the non-persisted QuickEdit store, not the persisted blob.
		useQuickEditStore.setState({ agentBlock: { id: 'live' } });
		expect(
			useWorkflowStore
				.getState()
				.getAvailableWorkflows()
				.map((w) => w.id),
		).toEqual(['needs-block']);
	});
});
