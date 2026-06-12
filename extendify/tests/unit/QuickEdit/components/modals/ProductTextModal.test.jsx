// ProductTextModal loads a product, surfaces a TextControl for `name` or a
// TextareaControl for `short_description`, and on Save writes the field via
// saveProduct + pushes a `product` undo entry. No-op when unchanged.

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
	Button: ({ children, onClick, disabled, isBusy }) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			data-busy={String(!!isBusy)}
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
	TextControl: ({ label, value, onChange }) => (
		<label>
			{label}
			<input
				aria-label={label}
				value={value || ''}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	),
	TextareaControl: ({ label, value, onChange, rows }) => (
		<label>
			{label}
			<textarea
				aria-label={label}
				value={value || ''}
				rows={rows}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	),
}));

const importComponent = () =>
	require('@quick-edit/components/modals/ProductTextModal');

const clickByText = (text) => {
	const btn = Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent === text,
	);
	fireEvent.click(btn);
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('ProductTextModal — load', () => {
	it('renders the Spinner before the load resolves', () => {
		mockLoadProduct.mockReturnValue(new Promise(() => {}));
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal productId={7} field="name" onAfterSave={jest.fn()} />,
		);
		expect(document.querySelector('[data-testid="spinner"]')).not.toBeNull();
	});

	it('surfaces an error Notice on load reject', async () => {
		mockLoadProduct.mockRejectedValueOnce(new Error('load failed'));
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal productId={7} field="name" onAfterSave={jest.fn()} />,
		);
		await waitFor(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
				/Sorry, something went wrong/i,
			),
		);
	});
});

describe('ProductTextModal — field=name', () => {
	beforeEach(() => {
		mockLoadProduct.mockResolvedValue({ name: 'Old Name' });
	});

	it('renders a TextControl seeded with the product name', async () => {
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal productId={7} field="name" onAfterSave={jest.fn()} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Product name"]'),
			).not.toBeNull(),
		);
		expect(
			document.querySelector('input[aria-label="Product name"]').value,
		).toBe('Old Name');
	});

	it('Save → saveProduct({ field: "name", value }) + product undo + track', async () => {
		mockSaveProduct.mockResolvedValue({});
		const onAfterSave = jest.fn();
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal productId={7} field="name" onAfterSave={onAfterSave} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Product name"]'),
			).not.toBeNull(),
		);
		fireEvent.change(
			document.querySelector('input[aria-label="Product name"]'),
			{ target: { value: 'New Name' } },
		);
		await act(async () => clickByText('Save'));
		expect(mockSaveProduct).toHaveBeenCalledWith({
			productId: 7,
			field: 'name',
			value: 'New Name',
		});
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'product',
			productReplay: true,
			productId: 7,
			field: 'name',
			beforeValue: 'Old Name',
		});
		expect(mockTrack).toHaveBeenCalledWith('save', {
			kind: 'product',
			field: 'name',
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});

	it('no-op when value unchanged: onAfterSave(false), no save call', async () => {
		const onAfterSave = jest.fn();
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal productId={7} field="name" onAfterSave={onAfterSave} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Product name"]'),
			).not.toBeNull(),
		);
		await act(async () => clickByText('Save'));
		expect(mockSaveProduct).not.toHaveBeenCalled();
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});

	it('saveProduct rejecting → save_failed + error Notice', async () => {
		mockSaveProduct.mockRejectedValueOnce(new Error('rejected'));
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal productId={7} field="name" onAfterSave={jest.fn()} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Product name"]'),
			).not.toBeNull(),
		);
		fireEvent.change(
			document.querySelector('input[aria-label="Product name"]'),
			{ target: { value: 'Other' } },
		);
		await act(async () => clickByText('Save'));
		expect(mockTrack).toHaveBeenCalledWith('save_failed', {
			kind: 'product',
			field: 'name',
		});
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});
});

describe('ProductTextModal — field=short_description', () => {
	it('renders a TextareaControl + saves with field=short_description', async () => {
		mockLoadProduct.mockResolvedValue({
			short_description: 'old desc',
		});
		mockSaveProduct.mockResolvedValue({});
		const onAfterSave = jest.fn();
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal
				productId={7}
				field="short_description"
				onAfterSave={onAfterSave}
			/>,
		);
		await waitFor(() =>
			expect(
				document.querySelector('textarea[aria-label="Short description"]'),
			).not.toBeNull(),
		);
		expect(
			document.querySelector('textarea[aria-label="Short description"]').value,
		).toBe('old desc');
		fireEvent.change(
			document.querySelector('textarea[aria-label="Short description"]'),
			{ target: { value: 'new desc' } },
		);
		await act(async () => clickByText('Save'));
		expect(mockSaveProduct).toHaveBeenCalledWith({
			productId: 7,
			field: 'short_description',
			value: 'new desc',
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});
});

describe('ProductTextModal — close', () => {
	it('Cancel calls onAfterSave(false)', async () => {
		mockLoadProduct.mockResolvedValue({ name: 'x' });
		const onAfterSave = jest.fn();
		const { ProductTextModal } = importComponent();
		render(
			<ProductTextModal productId={7} field="name" onAfterSave={onAfterSave} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Product name"]'),
			).not.toBeNull(),
		);
		clickByText('Cancel');
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});
