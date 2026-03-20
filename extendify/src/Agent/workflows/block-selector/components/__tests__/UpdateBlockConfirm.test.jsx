import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateBlockConfirm } from '../UpdateBlockConfirm';

jest.mock('@agent/lib/variant-classes', () => ({
	patchVariantClasses: (_html, el) => el.outerHTML,
}));
jest.mock('@agent/state/workflows', () => ({
	useWorkflowStore: () => ({ block: { id: 'block-1' } }),
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
