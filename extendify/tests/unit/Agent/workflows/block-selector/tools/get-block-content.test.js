import getBlockContent from '@agent/workflows/block-selector/tools/get-block-content';
import apiFetch from '@wordpress/api-fetch';

let mockAgentBlock;
jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: { getState: () => ({ agentBlock: mockAgentBlock }) },
}));
jest.mock('@wordpress/api-fetch', () => ({
	__esModule: true,
	default: jest.fn(() => Promise.resolve({ block: '<!-- wp:paragraph -->' })),
}));

describe('get-block-content tool', () => {
	beforeEach(() => {
		window.extAgentData = { context: { postId: 5 } };
		apiFetch.mockClear();
	});

	test('fetches the staged block code', async () => {
		mockAgentBlock = { id: '3' };
		const result = await getBlockContent();
		expect(apiFetch).toHaveBeenCalledWith({
			path: '/extendify/v1/agent/get-block-code?postId=5&blockId=3',
		});
		expect(result).toEqual({ previousContent: '<!-- wp:paragraph -->' });
	});

	// Mirrors the confirm components' read-site null-safety: with nothing
	// staged, bail to empty content rather than fetch with blockId=undefined.
	test('bails to empty content without fetching when no block is staged', async () => {
		mockAgentBlock = null;
		const result = await getBlockContent();
		expect(apiFetch).not.toHaveBeenCalled();
		expect(result).toEqual({ previousContent: '' });
	});
});
