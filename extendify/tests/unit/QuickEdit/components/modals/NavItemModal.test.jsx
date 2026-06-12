// NavItemModal saves a nav item's label + url through one of two endpoints
// depending on `selected.source.kind`:
//   - kind !== 'wp-navigation'  → SaveController via save() (inline items)
//   - kind === 'wp-navigation'  → saveWpNavigationItem (ref-based items)
// The undo entry shape mirrors the FORWARD endpoint so performUndo dispatches
// on the *Replay flag. Empty URL keeps the existing href.

import { act, fireEvent, render } from '@testing-library/react';

const mockSave = jest.fn();
const mockSaveWpNavigationItem = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();

jest.mock('@quick-edit/lib/api', () => ({
	save: (...args) => mockSave(...args),
	saveWpNavigationItem: (...args) => mockSaveWpNavigationItem(...args),
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

// LinkControl is heavy. We use the TextControl fallback by exporting undefined.
jest.mock('@wordpress/block-editor', () => ({
	__experimentalLinkControl: undefined,
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
	require('@quick-edit/components/modals/NavItemModal');

const liveEl = (label, url) => {
	const wrap = document.createElement('div');
	const a = document.createElement('a');
	a.setAttribute('href', url);
	const labelEl = document.createElement('span');
	labelEl.classList.add('wp-block-navigation-item__label');
	labelEl.textContent = label;
	a.appendChild(labelEl);
	wrap.appendChild(a);
	document.body.appendChild(wrap);
	return wrap;
};

const fillURL = (value) => {
	fireEvent.change(document.querySelector('input[aria-label="URL"]'), {
		target: { value },
	});
};

const fillLabel = (value) => {
	fireEvent.change(document.querySelector('input[aria-label="Label"]'), {
		target: { value },
	});
};

const clickByText = (text) => {
	const btn = Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent === text,
	);
	fireEvent.click(btn);
};

beforeEach(() => {
	jest.clearAllMocks();
	document.body.innerHTML = '';
});

describe('NavItemModal — inline (non-wp-navigation) save', () => {
	const renderModal = (overrides = {}) => {
		const el = liveEl('Old Label', 'https://example.test/old');
		const selected = {
			el,
			blockId: 'n-1',
			blockType: 'core/navigation-link',
			source: { kind: 'post', id: 1 },
			...overrides,
		};
		const onAfterSave = jest.fn();
		const { NavItemModal } = importComponent();
		render(<NavItemModal selected={selected} onAfterSave={onAfterSave} />);
		return { selected, onAfterSave };
	};

	it('seeds label + (cleared) URL field from the live element', () => {
		renderModal();
		expect(document.querySelector('input[aria-label="Label"]').value).toBe(
			'Old Label',
		);
		// URL is intentionally blank to start — "empty URL keeps the existing link"
		expect(document.querySelector('input[aria-label="URL"]').value).toBe('');
	});

	it('save() with both patches when both fields changed; undo carries old values', async () => {
		mockSave.mockResolvedValue({});
		const { onAfterSave } = renderModal();
		fillLabel('New Label');
		fillURL('https://example.test/new');
		await act(async () => clickByText('Save'));
		expect(mockSave).toHaveBeenCalledWith({
			source: { kind: 'post', id: 1 },
			blockId: 'n-1',
			blockType: 'core/navigation-link',
			fingerprint: { text: 'Old Label' },
			patches: [
				{ fieldKey: 'label', value: 'New Label' },
				{ fieldKey: 'url', value: 'https://example.test/new' },
			],
		});
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'nav-item',
			source: { kind: 'post', id: 1 },
			blockId: 'n-1',
			blockType: 'core/navigation-link',
			patches: [
				{ fieldKey: 'label', value: 'Old Label' },
				{ fieldKey: 'url', value: 'https://example.test/old' },
			],
		});
		expect(mockTrack).toHaveBeenCalledWith('save', { kind: 'nav_item' });
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});

	it('label-only change skips the url patch (empty URL keeps existing href)', async () => {
		mockSave.mockResolvedValue({});
		renderModal();
		fillLabel('Renamed');
		await act(async () => clickByText('Save'));
		expect(mockSave).toHaveBeenCalledWith(
			expect.objectContaining({
				patches: [{ fieldKey: 'label', value: 'Renamed' }],
			}),
		);
	});

	it('no patches → onAfterSave(false); no save', async () => {
		const { onAfterSave } = renderModal();
		await act(async () => clickByText('Save'));
		expect(mockSave).not.toHaveBeenCalled();
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});

	it('save rejecting → save_failed + error Notice', async () => {
		mockSave.mockRejectedValueOnce(new Error('rejected'));
		renderModal();
		fillLabel('Renamed');
		await act(async () => clickByText('Save'));
		expect(mockTrack).toHaveBeenCalledWith('save_failed', { kind: 'nav_item' });
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});
});

describe('NavItemModal — wp-navigation (ref-based) save', () => {
	it('routes through saveWpNavigationItem with navPostId + itemIndex + patches', async () => {
		mockSaveWpNavigationItem.mockResolvedValue({});
		const el = liveEl('About', 'https://example.test/about');
		const selected = {
			el,
			blockId: 'n-2',
			blockType: 'core/navigation-link',
			source: { kind: 'wp-navigation', id: 42 },
			navPostId: 42,
			itemIndex: 3,
		};
		const onAfterSave = jest.fn();
		const { NavItemModal } = importComponent();
		render(<NavItemModal selected={selected} onAfterSave={onAfterSave} />);
		fillLabel('About Us');
		fillURL('https://example.test/about-us');
		await act(async () => clickByText('Save'));
		expect(mockSave).not.toHaveBeenCalled();
		expect(mockSaveWpNavigationItem).toHaveBeenCalledWith({
			navPostId: 42,
			itemIndex: 3,
			blockType: 'core/navigation-link',
			fingerprint: { text: 'About' },
			patches: [
				{ fieldKey: 'label', value: 'About Us' },
				{ fieldKey: 'url', value: 'https://example.test/about-us' },
			],
		});
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'nav-item',
			navReplay: true,
			navPostId: 42,
			itemIndex: 3,
			blockType: 'core/navigation-link',
			patches: [
				{ fieldKey: 'label', value: 'About' },
				{ fieldKey: 'url', value: 'https://example.test/about' },
			],
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});
});

describe('NavItemModal — close', () => {
	it('Cancel calls onAfterSave(false)', () => {
		const el = liveEl('x', 'https://example.test');
		const selected = {
			el,
			blockId: 'n-1',
			blockType: 'core/navigation-link',
			source: { kind: 'post', id: 1 },
		};
		const onAfterSave = jest.fn();
		const { NavItemModal } = importComponent();
		render(<NavItemModal selected={selected} onAfterSave={onAfterSave} />);
		const cancel = Array.from(document.querySelectorAll('button')).find(
			(b) => b.textContent === 'Cancel',
		);
		fireEvent.click(cancel);
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});
