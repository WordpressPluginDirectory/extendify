import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectThemeVariation } from '../SelectThemeVariation';

const mockUndoChange = jest.fn();
jest.mock('@agent/hooks/useVariationOverride', () => ({
	useVariationOverride: () => ({ undoChange: mockUndoChange }),
}));
jest.mock('@agent/hooks/useThemeVariations', () => ({
	useThemeVariations: () => ({
		variations: [
			{
				title: 'Sunset',
				css: '.sunset{}',
				settings: {
					color: {
						palette: {
							theme: [
								{ slug: 'background', color: '#fff' },
								{ slug: 'primary', color: '#f00' },
							],
						},
					},
				},
			},
		],
		isLoading: false,
	}),
}));
jest.mock('@agent/state/chat', () => ({
	useChatStore: () => ({ addMessage: jest.fn(), messages: [] }),
}));

beforeEach(() => mockUndoChange.mockClear());

describe('SelectThemeVariation — undo on cancel/unmount', () => {
	test('calls undoChange on unmount without confirming', () => {
		const { unmount } = render(
			<SelectThemeVariation
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
				onLoad={jest.fn()}
			/>,
		);
		unmount();
		expect(mockUndoChange).toHaveBeenCalledTimes(1);
	});

	test('does not call undoChange after confirming', async () => {
		const onConfirm = jest.fn();
		const user = userEvent.setup();
		const { unmount } = render(
			<SelectThemeVariation
				onConfirm={onConfirm}
				onCancel={jest.fn()}
				onLoad={jest.fn()}
			/>,
		);
		// Select a variation first
		const btn = screen
			.getAllByRole('button')
			.find((b) => !b.textContent.match(/cancel|save/i));
		await user.click(btn);
		await user.click(screen.getByRole('button', { name: /save/i }));
		expect(onConfirm).toHaveBeenCalled();
		unmount();
		expect(mockUndoChange).not.toHaveBeenCalled();
	});
});
