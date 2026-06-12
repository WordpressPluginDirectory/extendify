// HeadingLevelButton restores the H1–H6 picker that the floating bar
// otherwise loses by hiding `.block-editor-block-switcher`.
// Pin: renders only for core/heading, shows the current level, click
// dispatches updateBlockAttributes({ level: N }) against the local
// BlockEditor registry.

import { act, fireEvent, render, waitFor } from '@testing-library/react';

const mockUpdateBlockAttributes = jest.fn();

let mockSelectedBlock = null;

jest.mock('@wordpress/data', () => ({
	useSelect: (fn) =>
		fn(() => ({
			getSelectedBlockClientId: () => mockSelectedBlock?.clientId ?? null,
			getBlock: () => mockSelectedBlock?.block ?? null,
		})),
	useDispatch: () => ({
		updateBlockAttributes: (...args) => mockUpdateBlockAttributes(...args),
	}),
}));

jest.mock('@wordpress/i18n', () => ({
	__: (s) => s,
	sprintf: (format, ...args) => {
		let i = 0;
		return format.replace(/%[ds]/g, () => String(args[i++]));
	},
}));

jest.mock('@wordpress/components', () => ({
	Button: ({ children, onClick, onMouseDown, label, role }) => (
		<button
			type="button"
			onClick={onClick}
			onMouseDown={onMouseDown}
			aria-label={label}
			role={role}
		>
			{children}
		</button>
	),
	Popover: ({ children }) => <div data-testid="popover">{children}</div>,
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockSelectedBlock = null;
});

const importButton = () =>
	require('@quick-edit/components/toolbar/HeadingLevelButton')
		.HeadingLevelButton;

const setHeading = (level) => {
	mockSelectedBlock = {
		clientId: 'block-1',
		block: { name: 'core/heading', attributes: { level } },
	};
};

describe('HeadingLevelButton — visibility', () => {
	it('renders nothing when no block is selected', () => {
		const HeadingLevelButton = importButton();
		const { container } = render(<HeadingLevelButton />);
		expect(container.firstChild).toBeNull();
	});

	it('renders nothing for non-heading blocks', () => {
		mockSelectedBlock = {
			clientId: 'p-1',
			block: { name: 'core/paragraph', attributes: {} },
		};
		const HeadingLevelButton = importButton();
		const { container } = render(<HeadingLevelButton />);
		expect(container.firstChild).toBeNull();
	});

	it('renders the current level for a heading block', () => {
		setHeading(3);
		const HeadingLevelButton = importButton();
		const { getByText } = render(<HeadingLevelButton />);
		expect(getByText('H3')).toBeTruthy();
	});

	it('defaults to H2 when the heading has no explicit level attribute', () => {
		mockSelectedBlock = {
			clientId: 'h-1',
			block: { name: 'core/heading', attributes: {} },
		};
		const HeadingLevelButton = importButton();
		const { getByText } = render(<HeadingLevelButton />);
		expect(getByText('H2')).toBeTruthy();
	});
});

describe('HeadingLevelButton — picker', () => {
	it('opens the picker on click and dispatches the level change', async () => {
		setHeading(2);
		const HeadingLevelButton = importButton();
		const { getByLabelText, container } = render(<HeadingLevelButton />);

		act(() => {
			fireEvent.click(getByLabelText('Heading level'));
		});

		await waitFor(() => {
			expect(container.querySelector('[data-testid="popover"]')).not.toBeNull();
		});

		const h4Option = getByLabelText('Heading 4');
		act(() => {
			fireEvent.click(h4Option);
		});

		expect(mockUpdateBlockAttributes).toHaveBeenCalledWith('block-1', {
			level: 4,
		});
	});

	it('renders all six heading levels in the picker', () => {
		setHeading(1);
		const HeadingLevelButton = importButton();
		const { getByLabelText } = render(<HeadingLevelButton />);

		act(() => {
			fireEvent.click(getByLabelText('Heading level'));
		});

		for (const n of [1, 2, 3, 4, 5, 6]) {
			expect(getByLabelText(`Heading ${n}`)).toBeTruthy();
		}
	});
});
