import { UpdateBlockConfirm } from '@agent/workflows/block-selector/components/UpdateBlockConfirm';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockAgentBlock;
jest.mock('@shared/lib/variant-classes', () => ({
	patchVariantClasses: (_html, el) => el.outerHTML,
}));
jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: (selector) => selector({ agentBlock: mockAgentBlock }),
}));
jest.mock('@wordpress/api-fetch', () => ({
	__esModule: true,
	default: jest.fn(() =>
		Promise.resolve({
			content: '<div data-extendify-temp-replacement="true">New Block</div>',
		}),
	),
}));

describe('UpdateBlockConfirm — undo on cancel/unmount', () => {
	let container;
	let originalBlock;

	beforeEach(() => {
		mockAgentBlock = { id: 'block-1' };
		container = document.createElement('div');
		originalBlock = document.createElement('div');
		originalBlock.setAttribute('data-extendify-agent-block-id', 'block-1');
		originalBlock.textContent = 'Original Block';
		container.appendChild(originalBlock);
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	const inputs = { newContent: '<div>New Block</div>' };

	test('restores original block when unmounted without confirming', async () => {
		const { unmount } = render(
			<UpdateBlockConfirm
				inputs={inputs}
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
				onRetry={jest.fn()}
			/>,
		);
		await screen.findByText(/review and confirm/i);
		// Original block was detached, temp replacement exists
		expect(
			document.querySelector('[data-extendify-temp-replacement]'),
		).toBeTruthy();
		unmount();
		// After unmount, temp replacement removed and original restored
		expect(
			document.querySelector('[data-extendify-temp-replacement]'),
		).toBeNull();
		expect(container.textContent).toContain('Original Block');
	});

	test('does not restore original block after confirming', async () => {
		const onConfirm = jest.fn();
		const user = userEvent.setup();
		const { unmount } = render(
			<UpdateBlockConfirm
				inputs={inputs}
				onConfirm={onConfirm}
				onCancel={jest.fn()}
				onRetry={jest.fn()}
			/>,
		);
		await screen.findByText(/review and confirm/i);
		await user.click(screen.getByRole('button', { name: /save/i }));
		expect(onConfirm).toHaveBeenCalled();
		unmount();
		// The temp replacement should still be in the DOM (not removed by undo)
		expect(
			document.querySelector('[data-extendify-temp-replacement]'),
		).toBeTruthy();
	});
});

// A block-selector confirm is only mounted by a `requires: ['block']` workflow,
// which Agent.jsx cancels before render when nothing is staged — so it should
// never see a null `agentBlock` in the gated flow. This pins the read-site
// null-safety (`block?.id`) directly, so a future workflow that renders the
// confirm without that gate can't crash on it.
describe('UpdateBlockConfirm — null-safe with no staged block', () => {
	beforeEach(() => {
		mockAgentBlock = null;
	});

	test('cancels without crashing when no block is staged', async () => {
		const onCancel = jest.fn();
		render(
			<UpdateBlockConfirm
				inputs={{ newContent: '<div>New Block</div>' }}
				onConfirm={jest.fn()}
				onCancel={onCancel}
				onRetry={jest.fn()}
			/>,
		);
		await waitFor(() => expect(onCancel).toHaveBeenCalled());
	});
});
