// SiteIdentityModal handles three kinds — title / tagline / logo — through one
// component. Load is shared via loadSiteIdentity(); save routes per `kind` and
// pushes an identityReplay-shaped undo so performUndo replays through
// saveSiteIdentity instead of SaveController.

import { act, fireEvent, render, waitFor } from '@testing-library/react';

const mockLoadSiteIdentity = jest.fn();
const mockSaveSiteIdentity = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();
let mediaUploadOnSelect;

jest.mock('@quick-edit/lib/api', () => ({
	loadSiteIdentity: (...args) => mockLoadSiteIdentity(...args),
	saveSiteIdentity: (...args) => mockSaveSiteIdentity(...args),
}));
jest.mock('@quick-edit/lib/cmd-enter-save', () => ({
	useCmdEnterSave: jest.fn(),
}));
jest.mock('@quick-edit/lib/insights', () => ({
	track: (...args) => mockTrack(...args),
}));
jest.mock('@quick-edit/lib/modal-root', () => ({
	closeModal: jest.fn(),
}));
jest.mock('@quick-edit/state/undo', () => ({
	pushUndo: (...args) => mockPushUndo(...args),
}));

jest.mock('@wordpress/block-editor', () => ({
	MediaUpload: ({ onSelect, render: renderProp }) => {
		mediaUploadOnSelect = onSelect;
		return renderProp({ open: () => {} });
	},
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
	Button: ({ children, onClick, disabled, isBusy, variant, isDestructive }) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			data-busy={String(!!isBusy)}
			data-variant={variant}
			data-destructive={String(!!isDestructive)}
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
}));

const importComponent = () =>
	require('@quick-edit/components/modals/SiteIdentityModal');

const clickByText = (text) => {
	const btn = Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent === text,
	);
	fireEvent.click(btn);
};

beforeEach(() => {
	jest.clearAllMocks();
	mediaUploadOnSelect = null;
});

describe('SiteIdentityModal — kind=title', () => {
	it('seeds + saves title, pushes identity-undo, tracks', async () => {
		mockLoadSiteIdentity.mockResolvedValue({
			title: 'Old Site',
			tagline: 'Old Tag',
			logo_id: 0,
		});
		mockSaveSiteIdentity.mockResolvedValue({});
		const onAfterSave = jest.fn();
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="title" onAfterSave={onAfterSave} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Site title"]'),
			).not.toBeNull(),
		);
		expect(document.querySelector('input[aria-label="Site title"]').value).toBe(
			'Old Site',
		);
		fireEvent.change(document.querySelector('input[aria-label="Site title"]'), {
			target: { value: 'New Site' },
		});
		await act(async () => clickByText('Save'));
		expect(mockSaveSiteIdentity).toHaveBeenCalledWith({ title: 'New Site' });
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'site-identity',
			identityKind: 'title',
			beforeValues: { title: 'Old Site' },
			identityReplay: true,
		});
		expect(mockTrack).toHaveBeenCalledWith('save', {
			kind: 'site_identity',
			field: 'title',
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});

	it('no-op when title unchanged → onAfterSave(false), no save call', async () => {
		mockLoadSiteIdentity.mockResolvedValue({
			title: 'Old Site',
			tagline: '',
			logo_id: 0,
		});
		const onAfterSave = jest.fn();
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="title" onAfterSave={onAfterSave} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Site title"]'),
			).not.toBeNull(),
		);
		await act(async () => clickByText('Save'));
		expect(mockSaveSiteIdentity).not.toHaveBeenCalled();
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});

	it('saveSiteIdentity rejecting → save_failed + error Notice', async () => {
		mockLoadSiteIdentity.mockResolvedValue({
			title: 'Old Site',
			tagline: '',
			logo_id: 0,
		});
		mockSaveSiteIdentity.mockRejectedValueOnce(new Error('rejected'));
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="title" onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Site title"]'),
			).not.toBeNull(),
		);
		fireEvent.change(document.querySelector('input[aria-label="Site title"]'), {
			target: { value: 'New Site' },
		});
		await act(async () => clickByText('Save'));
		expect(mockTrack).toHaveBeenCalledWith('save_failed', {
			kind: 'site_identity',
			field: 'title',
		});
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});
});

describe('SiteIdentityModal — kind=tagline', () => {
	it('saves tagline only (not title or logo_id)', async () => {
		mockLoadSiteIdentity.mockResolvedValue({
			title: 'Old Site',
			tagline: 'Old Tag',
			logo_id: 0,
		});
		mockSaveSiteIdentity.mockResolvedValue({});
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="tagline" onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Tagline"]'),
			).not.toBeNull(),
		);
		fireEvent.change(document.querySelector('input[aria-label="Tagline"]'), {
			target: { value: 'New Tag' },
		});
		await act(async () => clickByText('Save'));
		expect(mockSaveSiteIdentity).toHaveBeenCalledWith({ tagline: 'New Tag' });
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'site-identity',
			identityKind: 'tagline',
			beforeValues: { tagline: 'Old Tag' },
			identityReplay: true,
		});
	});
});

describe('SiteIdentityModal — kind=logo', () => {
	it('MediaUpload onSelect updates logo_id; Save calls saveSiteIdentity({ logo_id })', async () => {
		mockLoadSiteIdentity.mockResolvedValue({
			title: 'Old Site',
			tagline: '',
			logo_id: 0,
			logo_url: '',
		});
		mockSaveSiteIdentity.mockResolvedValue({});
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="logo" onAfterSave={jest.fn()} />);
		await waitFor(() => expect(mediaUploadOnSelect).not.toBeNull());
		await act(async () => {
			mediaUploadOnSelect({
				id: 909,
				url: 'https://wp.test/logo.png',
				sizes: { medium: { url: 'https://wp.test/logo-medium.png' } },
			});
			await Promise.resolve();
		});
		await act(async () => clickByText('Save'));
		expect(mockSaveSiteIdentity).toHaveBeenCalledWith({ logo_id: 909 });
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'site-identity',
			identityKind: 'logo',
			beforeValues: { logo_id: 0 },
			identityReplay: true,
		});
	});

	it('Remove button clears logo_id; Save writes logo_id: 0', async () => {
		mockLoadSiteIdentity.mockResolvedValue({
			title: '',
			tagline: '',
			logo_id: 111,
			logo_url: 'https://wp.test/logo.png',
		});
		mockSaveSiteIdentity.mockResolvedValue({});
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="logo" onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(
				Array.from(document.querySelectorAll('button')).some(
					(b) => b.textContent === 'Remove',
				),
			).toBe(true),
		);
		clickByText('Remove');
		await act(async () => clickByText('Save'));
		expect(mockSaveSiteIdentity).toHaveBeenCalledWith({ logo_id: 0 });
	});
});

describe('SiteIdentityModal — close + load error', () => {
	it('Cancel calls onAfterSave(false)', async () => {
		mockLoadSiteIdentity.mockResolvedValue({
			title: 'x',
			tagline: '',
			logo_id: 0,
		});
		const onAfterSave = jest.fn();
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="title" onAfterSave={onAfterSave} />);
		await waitFor(() =>
			expect(
				document.querySelector('input[aria-label="Site title"]'),
			).not.toBeNull(),
		);
		clickByText('Cancel');
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});

	it('load failure surfaces an error Notice', async () => {
		mockLoadSiteIdentity.mockRejectedValueOnce(new Error('load failed'));
		const { SiteIdentityModal } = importComponent();
		render(<SiteIdentityModal kind="title" onAfterSave={jest.fn()} />);
		await waitFor(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
				/Sorry, something went wrong/i,
			),
		);
	});
});
