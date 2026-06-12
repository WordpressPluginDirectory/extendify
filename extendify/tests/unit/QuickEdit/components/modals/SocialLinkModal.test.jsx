// SocialLinkModal reads the social-link service + url out of the live element's
// `wp-social-link-<service>` class + anchor href, then on Save sends the URL
// patch through SaveController with a `service`-fingerprint fallback (see the
// comment in the source for why — TagTemplateParts can drift the blockId on
// ref-based navs). Undo is skipped when the URL didn't change.

import { act, fireEvent, render } from '@testing-library/react';

const mockSave = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();

jest.mock('@quick-edit/lib/api', () => ({
	save: (...args) => mockSave(...args),
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
	TextControl: ({ label, value, onChange, type, placeholder }) => (
		<label>
			{label}
			<input
				aria-label={label}
				type={type || 'text'}
				value={value || ''}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	),
}));

const importComponent = () =>
	require('@quick-edit/components/modals/SocialLinkModal');

const liveEl = (service = 'twitter', href = 'https://twitter.com/example') => {
	const wrap = document.createElement('li');
	if (service) wrap.classList.add(`wp-social-link-${service}`);
	const a = document.createElement('a');
	a.setAttribute('href', href);
	wrap.appendChild(a);
	document.body.appendChild(wrap);
	return wrap;
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

describe('SocialLinkModal — initial render', () => {
	it('seeds the URL field from the anchor href + builds the per-service title', () => {
		const selected = {
			el: liveEl('facebook', 'https://facebook.com/example'),
			blockId: 'sl-1',
			blockType: 'core/social-link',
			source: { kind: 'post', id: 1 },
		};
		const { SocialLinkModal } = importComponent();
		render(<SocialLinkModal selected={selected} onAfterSave={jest.fn()} />);
		expect(document.querySelector('input[aria-label="URL"]').value).toBe(
			'https://facebook.com/example',
		);
		expect(
			document.querySelector('[role="dialog"]').getAttribute('aria-label'),
		).toBe('Edit Facebook link');
	});

	it('falls back to a generic title when no wp-social-link-* class is present', () => {
		const wrap = document.createElement('li');
		const a = document.createElement('a');
		a.setAttribute('href', 'https://example.test');
		wrap.appendChild(a);
		document.body.appendChild(wrap);
		const selected = {
			el: wrap,
			blockId: 'sl-1',
			blockType: 'core/social-link',
			source: { kind: 'post', id: 1 },
		};
		const { SocialLinkModal } = importComponent();
		render(<SocialLinkModal selected={selected} onAfterSave={jest.fn()} />);
		expect(
			document.querySelector('[role="dialog"]').getAttribute('aria-label'),
		).toBe('Edit social link');
	});
});

describe('SocialLinkModal — save', () => {
	it('sends fingerprint:{service} + patches[{fieldKey:"url"}]; pushes undo carrying the old url', async () => {
		mockSave.mockResolvedValue({});
		const selected = {
			el: liveEl('twitter', 'https://twitter.com/before'),
			blockId: 'sl-1',
			blockType: 'core/social-link',
			source: { kind: 'post', id: 1 },
		};
		const onAfterSave = jest.fn();
		const { SocialLinkModal } = importComponent();
		render(<SocialLinkModal selected={selected} onAfterSave={onAfterSave} />);
		fireEvent.change(document.querySelector('input[aria-label="URL"]'), {
			target: { value: 'https://twitter.com/after' },
		});
		await act(async () => clickByText('Save'));
		expect(mockSave).toHaveBeenCalledWith({
			source: { kind: 'post', id: 1 },
			blockId: 'sl-1',
			blockType: 'core/social-link',
			fingerprint: { service: 'twitter' },
			patches: [{ fieldKey: 'url', value: 'https://twitter.com/after' }],
		});
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'social-link',
			source: { kind: 'post', id: 1 },
			blockId: 'sl-1',
			blockType: 'core/social-link',
			fingerprint: { service: 'twitter' },
			patches: [{ fieldKey: 'url', value: 'https://twitter.com/before' }],
		});
		expect(mockTrack).toHaveBeenCalledWith('save', {
			kind: 'social_link',
			service: 'twitter',
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
	});

	it('skips pushUndo when the URL did not change', async () => {
		mockSave.mockResolvedValue({});
		const selected = {
			el: liveEl('twitter', 'https://twitter.com/same'),
			blockId: 'sl-1',
			blockType: 'core/social-link',
			source: { kind: 'post', id: 1 },
		};
		const { SocialLinkModal } = importComponent();
		render(<SocialLinkModal selected={selected} onAfterSave={jest.fn()} />);
		await act(async () => clickByText('Save'));
		expect(mockSave).toHaveBeenCalled();
		expect(mockPushUndo).not.toHaveBeenCalled();
	});

	it('save rejecting → save_failed (with service) + error Notice', async () => {
		mockSave.mockRejectedValueOnce(new Error('rejected'));
		const selected = {
			el: liveEl('linkedin', 'https://linkedin.com/in/x'),
			blockId: 'sl-1',
			blockType: 'core/social-link',
			source: { kind: 'post', id: 1 },
		};
		const { SocialLinkModal } = importComponent();
		render(<SocialLinkModal selected={selected} onAfterSave={jest.fn()} />);
		fireEvent.change(document.querySelector('input[aria-label="URL"]'), {
			target: { value: 'https://linkedin.com/in/y' },
		});
		await act(async () => clickByText('Save'));
		expect(mockTrack).toHaveBeenCalledWith('save_failed', {
			kind: 'social_link',
			service: 'linkedin',
		});
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});
});

describe('SocialLinkModal — close', () => {
	it('Cancel calls onAfterSave(false)', () => {
		const selected = {
			el: liveEl(),
			blockId: 'sl-1',
			blockType: 'core/social-link',
			source: { kind: 'post', id: 1 },
		};
		const onAfterSave = jest.fn();
		const { SocialLinkModal } = importComponent();
		render(<SocialLinkModal selected={selected} onAfterSave={onAfterSave} />);
		clickByText('Cancel');
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});
