import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectAnimation } from '../SelectAnimation';

jest.mock('@agent/lib/wp', () => ({
	getOption: jest.fn(() => Promise.resolve({ type: 'fade', speed: 'medium' })),
}));
jest.mock('@wordpress/components', () => ({
	// biome-ignore lint/correctness/noUnusedFunctionParameters: Mocking components, not implementing functionality
	__experimentalToggleGroupControl: ({ children, value, onChange }) => (
		<div data-testid="toggle-group">
			{children?.map?.((child) =>
				child
					? {
							...child,
							props: {
								...child.props,
								onClick: () => onChange(child.props.value),
							},
						}
					: null,
			)}
		</div>
	),
	__experimentalToggleGroupControlOption: ({ label, value }) => (
		<button type="button" data-value={value}>
			{label}
		</button>
	),
}));
jest.mock(
	'classnames',
	() =>
		(...args) =>
			args.filter(Boolean).join(' '),
);

const mockSetType = jest.fn();
const mockSetSpeed = jest.fn();

beforeEach(() => {
	window.ExtendableAnimations = {
		setType: mockSetType,
		setSpeed: mockSetSpeed,
	};
	mockSetType.mockClear();
	mockSetSpeed.mockClear();
});

describe('SelectAnimation — undo on cancel/unmount', () => {
	test('restores initial animation settings on unmount without confirming', async () => {
		const user = userEvent.setup();
		const { unmount } = render(
			<SelectAnimation
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
				onLoad={jest.fn()}
			/>,
		);
		// Wait for loading to finish
		await screen.findByText(/cancel/i);

		// Touch the animation by clicking a type button
		const zoomBtn = screen.getByText('Zoom In');
		await user.click(zoomBtn);

		mockSetType.mockClear();
		mockSetSpeed.mockClear();

		unmount();
		expect(mockSetType).toHaveBeenCalledWith('fade');
		expect(mockSetSpeed).toHaveBeenCalledWith('medium');
	});

	test('does not restore settings after confirming', async () => {
		const onConfirm = jest.fn();
		const user = userEvent.setup();
		const { unmount } = render(
			<SelectAnimation
				onConfirm={onConfirm}
				onCancel={jest.fn()}
				onLoad={jest.fn()}
			/>,
		);
		await screen.findByText(/cancel/i);

		const zoomBtn = screen.getByText('Zoom In');
		await user.click(zoomBtn);

		mockSetType.mockClear();
		mockSetSpeed.mockClear();

		await user.click(screen.getByRole('button', { name: /save/i }));
		expect(onConfirm).toHaveBeenCalled();

		unmount();
		expect(mockSetType).not.toHaveBeenCalled();
		expect(mockSetSpeed).not.toHaveBeenCalled();
	});
});
