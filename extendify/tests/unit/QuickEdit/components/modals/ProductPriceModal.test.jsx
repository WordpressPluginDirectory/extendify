// ProductPriceModal loads { regular_price, sale_price } via loadProduct,
// surfaces both as TextControls, then on save writes
// saveProduct({ field: 'price', value: { regular, sale } }) and pushes an undo
// shaped for the productReplay branch. No-op when nothing changed.

import { act, fireEvent, render, waitFor } from '@testing-library/react';

const mockLoadProduct = jest.fn();
const mockSaveProduct = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();

jest.mock('@quick-edit/lib/api', () => ({
	loadProduct: (...args) => mockLoadProduct(...args),
	saveProduct: (...args) => mockSaveProduct(...args),
}));
jest.mock('@quick-edit/lib/cmd-enter-save', () => ({
	useCmdEnterSave: jest.fn(),
}));
jest.mock('@quick-edit/lib/insights', () => ({
	track: (...args) => mockTrack(...args),
}));
jest.mock('@quick-edit/state/undo', () => ({
	pushUndo: (...args) => mockPushUndo(...args),
}));

jest.mock('@wordpress/components', () => ({
	Modal: ({ title, onRequestClose, children }) => (
		<div role="dialog" aria-label={title}>
			<button
				type="button"
				data-testid="modal-close"
				onClick={onRequestClose}
			/>
			{children}
		</div>
	),
	Button: ({ children, onClick, disabled, isBusy, variant }) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			data-busy={String(!!isBusy)}
			data-variant={variant}
		>
			{children}
		</button>
	),
	Notice: ({ children, status }) => (
		<div role="alert" data-status={status}>
			{children}
		</div>
	),
	Spinner: () => <span data-testid="spinner" />,
	TextControl: ({ label, value, onChange, placeholder }) => (
		<label>
			{label}
			<input
				aria-label={label}
				value={value || ''}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	),
}));

const importComponent = () =>
	require('@quick-edit/components/modals/ProductPriceModal');

const fillField = (label, value) => {
	const input = document.querySelector(`input[aria-label="${label}"]`);
	fireEvent.change(input, { target: { value } });
};

const clickByText = (text) => {
	const btn = Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent === text,
	);
	fireEvent.click(btn);
};

beforeEach(() => {
	jest.clearAllMocks();
	delete window.extQuickEditData;
});

describe('ProductPriceModal — load', () => {
	it('shows a Spinner while loading, then both TextControls seeded from the product', async () => {
		mockLoadProduct.mockResolvedValue({
			regular_price: '19.99',
			sale_price: '14.99',
		});
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={jest.fn()} />);
		expect(document.querySelector('[data-testid="spinner"]')).not.toBeNull();
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Regular price"]'),
			).not.toBeNull(),
		);
		expect(
			document.querySelector('input[aria-label="Regular price"]').value,
		).toBe('19.99');
		expect(
			document.querySelector('input[aria-label="Sale price (optional)"]').value,
		).toBe('14.99');
	});

	it('renders a Notice when the load rejects', async () => {
		mockLoadProduct.mockRejectedValueOnce(new Error('product gone'));
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
				/Sorry, something went wrong/i,
			),
		);
	});

	it('falls back to "$" when extQuickEditData.context.currencySymbol is missing', async () => {
		mockLoadProduct.mockResolvedValue({ regular_price: '0', sale_price: '' });
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(
				document.querySelectorAll('.extendify-quick-edit-price-prefix').length,
			).toBe(2),
		);
		const prefixes = document.querySelectorAll(
			'.extendify-quick-edit-price-prefix',
		);
		expect(prefixes[0].textContent).toBe('$');
	});

	it('reads currencySymbol from extQuickEditData when present', async () => {
		window.extQuickEditData = { context: { currencySymbol: '€' } };
		mockLoadProduct.mockResolvedValue({ regular_price: '10', sale_price: '' });
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(
				document.querySelectorAll('.extendify-quick-edit-price-prefix').length,
			).toBe(2),
		);
		const prefixes = document.querySelectorAll(
			'.extendify-quick-edit-price-prefix',
		);
		expect(prefixes[0].textContent).toBe('€');
	});
});

describe('ProductPriceModal — save', () => {
	it('saveProduct with { field: "price", value: { regular, sale } } + undo + track', async () => {
		mockLoadProduct.mockResolvedValue({
			regular_price: '19.99',
			sale_price: '',
		});
		mockSaveProduct.mockResolvedValue({});
		const onAfterSave = jest.fn();
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={onAfterSave} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Regular price"]'),
			).not.toBeNull(),
		);
		fillField('Regular price', '24.99');
		fillField('Sale price (optional)', '19.99');
		await act(async () => {
			clickByText('Save');
			await Promise.resolve();
		});
		expect(mockSaveProduct).toHaveBeenCalledWith({
			productId: 7,
			field: 'price',
			value: { regular: '24.99', sale: '19.99' },
		});
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'product-price',
			productReplay: true,
			productId: 7,
			field: 'price',
			beforeValue: { regular: '19.99', sale: '' },
		});
		expect(mockTrack).toHaveBeenCalledWith('save', {
			kind: 'product',
			field: 'price',
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});

	it('no-op when neither field changed: onAfterSave(false), no save call', async () => {
		mockLoadProduct.mockResolvedValue({
			regular_price: '19.99',
			sale_price: '14.99',
		});
		const onAfterSave = jest.fn();
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={onAfterSave} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Regular price"]'),
			).not.toBeNull(),
		);
		await act(async () => {
			clickByText('Save');
			await Promise.resolve();
		});
		expect(mockSaveProduct).not.toHaveBeenCalled();
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});

	it('saveProduct rejecting surfaces error Notice + tracks save_failed', async () => {
		mockLoadProduct.mockResolvedValue({
			regular_price: '19.99',
			sale_price: '',
		});
		mockSaveProduct.mockRejectedValueOnce(new Error('rejected'));
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Regular price"]'),
			).not.toBeNull(),
		);
		fillField('Regular price', '24.99');
		await act(async () => {
			clickByText('Save');
			await Promise.resolve();
		});
		expect(mockTrack).toHaveBeenCalledWith('save_failed', {
			kind: 'product',
			field: 'price',
		});
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});

	it('Cancel button calls onAfterSave(false)', async () => {
		mockLoadProduct.mockResolvedValue({
			regular_price: '19.99',
			sale_price: '',
		});
		const onAfterSave = jest.fn();
		const { ProductPriceModal } = importComponent();
		render(<ProductPriceModal productId={7} onAfterSave={onAfterSave} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Regular price"]'),
			).not.toBeNull(),
		);
		clickByText('Cancel');
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});
