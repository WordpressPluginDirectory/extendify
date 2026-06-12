// WPFormsFieldModal loads a single WPForms field via loadWpFormsField, surfaces
// label / placeholder / description / required, and on Save sends ONLY the
// changed keys through saveWpFormsField — choices, validation, and conditional
// logic are explicitly untouched. The placeholder field is hidden for the
// `name` composite type and for select/checkbox/radio.

import { act, fireEvent, render, waitFor } from '@testing-library/react';

const mockLoadWpFormsField = jest.fn();
const mockSaveWpFormsField = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();

jest.mock('@quick-edit/lib/api', () => ({
	loadWpFormsField: (...args) => mockLoadWpFormsField(...args),
	saveWpFormsField: (...args) => mockSaveWpFormsField(...args),
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
	ToggleControl: ({ label, checked, onChange }) => (
		<label>
			{label}
			<input
				type="checkbox"
				aria-label={label}
				checked={!!checked}
				onChange={(e) => onChange(e.target.checked)}
			/>
		</label>
	),
}));

const importComponent = () =>
	require('@quick-edit/components/modals/WPFormsFieldModal');

const fill = (label, value) => {
	const input = document.querySelector(
		`input[aria-label="${label}"], textarea[aria-label="${label}"]`,
	);
	fireEvent.change(input, { target: { value } });
};

const toggle = (label) => {
	const input = document.querySelector(
		`input[type="checkbox"][aria-label="${label}"]`,
	);
	fireEvent.click(input);
};

const clickByText = (text) => {
	const btn = Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent === text,
	);
	fireEvent.click(btn);
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('WPFormsFieldModal — load', () => {
	it('shows the Spinner before the load resolves', () => {
		mockLoadWpFormsField.mockReturnValue(new Promise(() => {}));
		const { WPFormsFieldModal } = importComponent();
		render(
			<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={jest.fn()} />,
		);
		expect(document.querySelector('[data-testid="spinner"]')).not.toBeNull();
	});

	it('seeds all four inputs from the loaded field', async () => {
		mockLoadWpFormsField.mockResolvedValue({
			type: 'text',
			label: 'Your name',
			placeholder: 'e.g. Ada',
			description: 'How to address you',
			required: true,
		});
		const { WPFormsFieldModal } = importComponent();
		render(
			<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={jest.fn()} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Label"]'),
			).not.toBeNull(),
		);
		expect(document.querySelector('input[aria-label="Label"]').value).toBe(
			'Your name',
		);
		expect(
			document.querySelector('input[aria-label="Placeholder"]').value,
		).toBe('e.g. Ada');
		expect(
			document.querySelector(
				'textarea[aria-label="Description (shown below the field)"]',
			).value,
		).toBe('How to address you');
		expect(
			document.querySelector('input[aria-label="Required field"]').checked,
		).toBe(true);
	});

	it('renders a Notice when the load rejects', async () => {
		mockLoadWpFormsField.mockRejectedValueOnce(new Error('field 404'));
		const { WPFormsFieldModal } = importComponent();
		render(
			<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={jest.fn()} />,
		);
		await waitFor(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
				/Sorry, something went wrong/i,
			),
		);
	});
});

describe('WPFormsFieldModal — placeholder visibility', () => {
	const cases = [
		['text', true],
		['textarea', true],
		['email', true],
		['name', false],
		['select', false],
		['checkbox', false],
		['radio', false],
	];

	for (const [type, expected] of cases) {
		it(`type=${type} → placeholder ${expected ? 'visible' : 'hidden'}`, async () => {
			mockLoadWpFormsField.mockResolvedValue({
				type,
				label: 'x',
				placeholder: '',
				description: '',
				required: false,
			});
			const { WPFormsFieldModal } = importComponent();
			render(
				<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={jest.fn()} />,
			);
			await waitFor(() =>
				expect(
					document.querySelector('input[aria-label="Label"]'),
				).not.toBeNull(),
			);
			const placeholder = document.querySelector(
				'input[aria-label="Placeholder"]',
			);
			if (expected) {
				expect(placeholder).not.toBeNull();
			} else {
				expect(placeholder).toBeNull();
			}
		});
	}
});

describe('WPFormsFieldModal — save', () => {
	it('sends ONLY the changed keys + tracks save with the field type', async () => {
		mockLoadWpFormsField.mockResolvedValue({
			type: 'text',
			label: 'Your name',
			placeholder: 'Ada',
			description: 'How to address you',
			required: false,
		});
		mockSaveWpFormsField.mockResolvedValue({});
		const onAfterSave = jest.fn();
		const { WPFormsFieldModal } = importComponent();
		render(
			<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={onAfterSave} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Label"]'),
			).not.toBeNull(),
		);
		fill('Label', 'Your full name');
		toggle('Required field');
		await act(async () => clickByText('Save'));
		expect(mockSaveWpFormsField).toHaveBeenCalledWith({
			formId: 12,
			fieldId: 'f-3',
			changes: { label: 'Your full name', required: true },
		});
		// pushUndo carries the INVERSE of the changes bag so performUndo's
		// wpformsReplay branch can shallow-merge the originals back in.
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'wpforms-field',
			wpformsReplay: true,
			formId: 12,
			fieldId: 'f-3',
			changes: { label: 'Your name', required: false },
		});
		expect(mockTrack).toHaveBeenCalledWith('save', {
			kind: 'wpforms_field',
			type: 'text',
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});

	it('no-op when nothing changed → onAfterSave(false), no save call', async () => {
		mockLoadWpFormsField.mockResolvedValue({
			type: 'text',
			label: 'Your name',
			placeholder: '',
			description: '',
			required: false,
		});
		const onAfterSave = jest.fn();
		const { WPFormsFieldModal } = importComponent();
		render(
			<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={onAfterSave} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Label"]'),
			).not.toBeNull(),
		);
		await act(async () => clickByText('Save'));
		expect(mockSaveWpFormsField).not.toHaveBeenCalled();
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});

	it('saveWpFormsField rejecting → save_failed + error Notice', async () => {
		mockLoadWpFormsField.mockResolvedValue({
			type: 'text',
			label: 'x',
			placeholder: '',
			description: '',
			required: false,
		});
		mockSaveWpFormsField.mockRejectedValueOnce(new Error('boom'));
		const { WPFormsFieldModal } = importComponent();
		render(
			<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={jest.fn()} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Label"]'),
			).not.toBeNull(),
		);
		fill('Label', 'y');
		await act(async () => clickByText('Save'));
		expect(mockTrack).toHaveBeenCalledWith('save_failed', {
			kind: 'wpforms_field',
			type: 'text',
		});
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
		expect(mockPushUndo).not.toHaveBeenCalled();
	});
});

describe('WPFormsFieldModal — close', () => {
	it('Cancel calls onAfterSave(false)', async () => {
		mockLoadWpFormsField.mockResolvedValue({
			type: 'text',
			label: 'x',
			placeholder: '',
			description: '',
			required: false,
		});
		const onAfterSave = jest.fn();
		const { WPFormsFieldModal } = importComponent();
		render(
			<WPFormsFieldModal formId={12} fieldId="f-3" onAfterSave={onAfterSave} />,
		);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Label"]'),
			).not.toBeNull(),
		);
		clickByText('Cancel');
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});
