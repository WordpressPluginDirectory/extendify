// AiImagePickerModal generates an image via @shared/api/DataApi.generateImage,
// shows the preview, then on "Use" imports the image into the media library and
// either (a) saves through SaveController + splices DOM in-place for the
// post-context case, or (b) writes through saveProduct + reloads for the
// product-context case. These tests pin the contract per branch plus the
// **no-PII** posture: the generateImage payload carries `prompt` + `size` and
// nothing partner-identifying.

import { act, fireEvent, render, waitFor } from '@testing-library/react';

const mockGenerateImage = jest.fn();
const mockImportImage = jest.fn();
const mockImportImageServer = jest.fn();
const mockSave = jest.fn();
const mockSaveProduct = jest.fn();
const mockLoadProduct = jest.fn();
const mockSplice = jest.fn();
const mockInvalidate = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();
const mockSetAiImageOption = jest.fn();
const mockUpdateCredits = jest.fn();
const mockSubtractCredit = jest.fn();
const mockUseCmdEnterSave = jest.fn();

let mockImageStoreState;

jest.mock('@shared/api/DataApi', () => ({
	generateImage: (...args) => mockGenerateImage(...args),
}));
jest.mock('@quick-edit/lib/cmd-enter-save', () => ({
	useCmdEnterSave: (...args) => mockUseCmdEnterSave(...args),
}));
jest.mock('@shared/api/wp', () => ({
	importImage: (...args) => mockImportImage(...args),
	importImageServer: (...args) => mockImportImageServer(...args),
}));
jest.mock('@shared/state/generate-images', () => ({
	useImageGenerationStore: () => mockImageStoreState,
}));
jest.mock('@quick-edit/lib/api', () => ({
	loadProduct: (...args) => mockLoadProduct(...args),
	save: (...args) => mockSave(...args),
	saveProduct: (...args) => mockSaveProduct(...args),
}));
jest.mock('@quick-edit/lib/block-source-cache', () => ({
	invalidateBlockSource: (...args) => mockInvalidate(...args),
}));
jest.mock('@quick-edit/lib/dom', () => ({
	splice: (...args) => mockSplice(...args),
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
			data-variant={variant}
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
	TextareaControl: ({ label, value, onChange }) => (
		<label>
			{label}
			<textarea
				aria-label={label}
				value={value || ''}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	),
	__experimentalToggleGroupControl: ({ label, children }) => (
		<div role="radiogroup" aria-label={label}>
			{children}
		</div>
	),
	__experimentalToggleGroupControlOption: ({ value, label }) => (
		<span data-toggle-option={value}>{label}</span>
	),
}));

const importComponent = () =>
	require('@quick-edit/components/modals/AiImagePickerModal');

const liveImageEl = () => {
	const wrap = document.createElement('figure');
	const img = document.createElement('img');
	img.src = 'https://example.test/before.jpg';
	img.alt = 'before';
	img.className = 'wp-image-77';
	wrap.appendChild(img);
	document.body.appendChild(wrap);
	return wrap;
};

const baseSelected = () => ({
	el: liveImageEl(),
	blockId: 'b-img',
	blockType: 'core/image',
	source: { kind: 'post', id: 42 },
});

const clickByLabel = (label) => {
	const btn = Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent === label,
	);
	fireEvent.click(btn);
};

const findByLabel = (label) =>
	Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent === label,
	);

beforeEach(() => {
	jest.clearAllMocks();
	document.body.innerHTML = '';
	mockImageStoreState = {
		imageCredits: { remaining: 10, total: 10 },
		updateImageCredits: mockUpdateCredits,
		subtractOneCredit: mockSubtractCredit,
		aiImageOptions: { prompt: 'a quiet lake', size: '1024x1024' },
		setAiImageOption: mockSetAiImageOption,
	};
});

describe('AiImagePickerModal — initial render', () => {
	it('renders the prompt textarea + Generate button (form state)', () => {
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		expect(
			document.querySelector('textarea[aria-label="Image prompt"]'),
		).not.toBeNull();
		expect(findByLabel('Generate')).not.toBeUndefined();
	});

	it('credits-exhausted: Generate button disables + relabels to "Out of credits"', () => {
		mockImageStoreState.imageCredits = { remaining: 0, total: 10 };
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		const btn = findByLabel('Out of credits');
		expect(btn).not.toBeUndefined();
		expect(btn.disabled).toBe(true);
	});
});

describe('AiImagePickerModal — generate', () => {
	it('calls generateImage with the AI options (no PII)', async () => {
		mockGenerateImage.mockResolvedValue({
			imageCredits: { remaining: 9, total: 10 },
			images: [{ url: 'https://ai.test/x.jpg' }],
			id: 'gen-1',
		});
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled());
		const [payload, signal] = mockGenerateImage.mock.calls[0];
		expect(payload).toEqual({ prompt: 'a quiet lake', size: '1024x1024' });
		expect(Object.keys(payload).sort()).toEqual(['prompt', 'size']);
		expect(signal).toBeInstanceOf(AbortSignal);
	});

	it('emits track("ai_image_generated", { size }) on success', async () => {
		mockGenerateImage.mockResolvedValue({
			imageCredits: { remaining: 9, total: 10 },
			images: [{ url: 'https://ai.test/x.jpg' }],
			id: 'gen-1',
		});
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() =>
			expect(mockTrack).toHaveBeenCalledWith('ai_image_generated', {
				size: '1024x1024',
			}),
		);
	});

	it('surfaces an error Notice when generate rejects with a plain Error', async () => {
		mockGenerateImage.mockRejectedValueOnce(new Error('upstream is down'));
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toBe(
				'upstream is down',
			),
		);
		expect(mockTrack).toHaveBeenCalledWith('ai_image_failed');
	});

	it('no-credits rejection writes the returned credits + emits "no_credits" reason', async () => {
		mockGenerateImage.mockRejectedValueOnce({
			message: 'You are out of credits',
			imageCredits: { remaining: 0, total: 10 },
		});
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() =>
			expect(mockUpdateCredits).toHaveBeenCalledWith({
				remaining: 0,
				total: 10,
			}),
		);
		expect(mockTrack).toHaveBeenCalledWith('ai_image_failed', {
			reason: 'no_credits',
		});
	});

	it('aborted generate (err.code === 20) is swallowed silently', async () => {
		mockGenerateImage.mockRejectedValueOnce({ code: 20 });
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await act(async () => {
			clickByLabel('Generate');
			await Promise.resolve();
		});
		expect(document.querySelector('[role="alert"]')).toBeNull();
		expect(mockTrack).not.toHaveBeenCalledWith(
			'ai_image_failed',
			expect.anything(),
		);
	});
});

describe('AiImagePickerModal — Use image (post-context happy path)', () => {
	beforeEach(() => {
		mockGenerateImage.mockResolvedValue({
			imageCredits: { remaining: 9, total: 10 },
			images: [{ url: 'https://ai.test/x.jpg' }],
			id: 'gen-1',
		});
		mockImportImage.mockResolvedValue({
			id: 909,
			url: 'https://wp.test/wp-content/uploads/x.jpg',
		});
		mockSave.mockResolvedValue({ rendered: '<figure>new</figure>' });
		mockSplice.mockReturnValue(document.createElement('figure'));
	});

	const drive = async (selected) => {
		const onAfterSave = jest.fn();
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={selected}
				field="image"
				onAfterSave={onAfterSave}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() => expect(findByLabel('Use image')).not.toBeUndefined());
		clickByLabel('Use image');
		return onAfterSave;
	};

	it('imports via importImage, then save() with the patches envelope', async () => {
		const sel = baseSelected();
		const onAfterSave = await drive(sel);
		await waitFor(() => expect(mockSave).toHaveBeenCalled());
		expect(mockImportImage).toHaveBeenCalledWith('https://ai.test/x.jpg', {
			alt: 'a quiet lake',
			filename: 'ai-image.jpg',
			caption: '',
		});
		expect(mockSave).toHaveBeenCalledWith({
			source: { kind: 'post', id: 42 },
			blockId: 'b-img',
			blockType: 'core/image',
			patches: [
				{
					fieldKey: 'image',
					value: {
						url: 'https://wp.test/wp-content/uploads/x.jpg',
						id: 909,
						alt: 'a quiet lake',
					},
				},
			],
		});
		await waitFor(() => expect(onAfterSave).toHaveBeenCalledWith(true));
	});

	it('splices the rendered HTML, invalidates cache, pushes an undo with the before image', async () => {
		const sel = baseSelected();
		await drive(sel);
		await waitFor(() => expect(mockSplice).toHaveBeenCalled());
		expect(mockSplice).toHaveBeenCalledWith(sel.el, '<figure>new</figure>');
		expect(mockInvalidate).toHaveBeenCalledWith(
			{ kind: 'post', id: 42 },
			'b-img',
		);
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'image',
			source: { kind: 'post', id: 42 },
			blockId: 'b-img',
			blockType: 'core/image',
			patches: [
				{
					fieldKey: 'image',
					value: {
						url: 'https://example.test/before.jpg',
						id: 77,
						alt: 'before',
					},
				},
			],
		});
		expect(mockTrack).toHaveBeenCalledWith('image_replaced', { source: 'ai' });
	});

	it('falls back to importImageServer when importImage rejects', async () => {
		mockImportImage.mockRejectedValueOnce(new Error('blocked by cors'));
		mockImportImageServer.mockResolvedValue({
			id: 808,
			source_url: 'https://wp.test/wp-content/uploads/srv.jpg',
		});
		await drive(baseSelected());
		await waitFor(() => expect(mockImportImageServer).toHaveBeenCalled());
		expect(mockSave).toHaveBeenCalledWith(
			expect.objectContaining({
				patches: [
					expect.objectContaining({
						value: expect.objectContaining({ id: 808 }),
					}),
				],
			}),
		);
	});
});

describe('AiImagePickerModal — Use image (product-context branch)', () => {
	it('saveProduct(image) + reload, never touches splice/save/invalidate', async () => {
		mockGenerateImage.mockResolvedValue({
			imageCredits: { remaining: 9, total: 10 },
			images: [{ url: 'https://ai.test/x.jpg' }],
			id: 'gen-1',
		});
		mockImportImage.mockResolvedValue({
			id: 909,
			url: 'https://wp.test/x.jpg',
		});
		mockLoadProduct.mockResolvedValue({ image_id: 11 });
		mockSaveProduct.mockResolvedValue({});
		const sel = {
			...baseSelected(),
			source: { kind: 'product', id: 55 },
		};
		const onAfterSave = jest.fn();
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={sel}
				field="image"
				onAfterSave={onAfterSave}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() => expect(findByLabel('Use image')).not.toBeUndefined());
		clickByLabel('Use image');
		await waitFor(() =>
			expect(mockSaveProduct).toHaveBeenCalledWith({
				productId: 55,
				field: 'image',
				value: 909,
			}),
		);
		expect(mockSave).not.toHaveBeenCalled();
		expect(mockSplice).not.toHaveBeenCalled();
		expect(mockInvalidate).not.toHaveBeenCalled();
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'product-image',
			productReplay: true,
			productId: 55,
			field: 'image',
			beforeValue: 11,
		});
		expect(mockTrack).toHaveBeenCalledWith('image_replaced', {
			source: 'ai',
			kind: 'product',
		});
		await waitFor(() => expect(onAfterSave).toHaveBeenCalledWith(true));
	});
});

describe('AiImagePickerModal — close + sad-path on Use', () => {
	it('Cancel button calls onAfterSave(false)', () => {
		const onAfterSave = jest.fn();
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={onAfterSave}
			/>,
		);
		clickByLabel('Cancel');
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});

	it('surfaces an error Notice + tracks save_failed when both import paths fail', async () => {
		mockGenerateImage.mockResolvedValue({
			imageCredits: { remaining: 9, total: 10 },
			images: [{ url: 'https://ai.test/x.jpg' }],
			id: 'gen-1',
		});
		mockImportImage.mockRejectedValueOnce(new Error('client import'));
		mockImportImageServer.mockRejectedValueOnce(new Error('server import'));
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() => expect(findByLabel('Use image')).not.toBeUndefined());
		clickByLabel('Use image');
		await waitFor(() =>
			expect(mockTrack).toHaveBeenCalledWith('save_failed', {
				kind: 'image',
				source: 'ai',
			}),
		);
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});
});

describe('AiImagePickerModal — ⌘/Ctrl+Enter wiring', () => {
	const lastCall = () => {
		const calls = mockUseCmdEnterSave.mock.calls;
		return calls[calls.length - 1] ?? [];
	};

	it('binds the prompt-state Generate action, enabled when Generate would be too', () => {
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		const [onSave, enabled] = lastCall();
		expect(typeof onSave).toBe('function');
		expect(enabled).toBe(true);
	});

	it('disables the binding when the prompt is empty (matches button disabled state)', () => {
		mockImageStoreState.aiImageOptions = { prompt: '', size: '1024x1024' };
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		expect(lastCall()[1]).toBe(false);
	});

	it('disables the binding when out of credits (matches button disabled state)', () => {
		mockImageStoreState.imageCredits = { remaining: 0, total: 10 };
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		expect(lastCall()[1]).toBe(false);
	});

	it('disables the binding once a preview is showing (Generate is no longer the primary action)', async () => {
		mockGenerateImage.mockResolvedValue({
			imageCredits: { remaining: 9, total: 10 },
			images: [{ url: 'https://ai.test/x.jpg' }],
			id: 'gen-1',
		});
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() => expect(findByLabel('Use image')).not.toBeUndefined());
		expect(lastCall()[1]).toBe(false);
	});

	it('the bound onSave triggers generateImage (cmd+Enter ≡ clicking Generate)', async () => {
		mockGenerateImage.mockResolvedValue({
			imageCredits: { remaining: 9, total: 10 },
			images: [{ url: 'https://ai.test/x.jpg' }],
			id: 'gen-1',
		});
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		const [onSave] = lastCall();
		await act(async () => {
			onSave();
			await Promise.resolve();
		});
		await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled());
	});
});

// Generation progress announces politely
// and the credits readout is a polite live region so credit changes are heard.
describe('AiImagePickerModal — a11y status regions', () => {
	it('the credits readout is a polite live region', () => {
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		const credits = document.querySelector('.extendify-quick-edit-ai-credits');
		expect(credits).not.toBeNull();
		expect(credits.getAttribute('aria-live')).toBe('polite');
	});

	it('announces generation progress via a role="status" region', async () => {
		mockGenerateImage.mockReturnValueOnce(new Promise(() => {}));
		const { AiImagePickerModal } = importComponent();
		render(
			<AiImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		clickByLabel('Generate');
		await waitFor(() => {
			const gen = document.querySelector('.extendify-quick-edit-ai-generating');
			expect(gen).not.toBeNull();
			expect(gen.getAttribute('role')).toBe('status');
		});
	});
});
