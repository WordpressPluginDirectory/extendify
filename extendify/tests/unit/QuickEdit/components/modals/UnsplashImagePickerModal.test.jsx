// UnsplashImagePickerModal seeds its first fetch from the site profile's first
// imageSearchTerm (not from the shared Unsplash cache — see the comment in the
// source), debounces typed searches, then on click downloads the picked image
// into the media library and either (a) save() + splice for post sources or
// (b) saveProduct + reload for product sources. Tests pin both branches plus
// the load + download sad paths.

import { act, fireEvent, render, waitFor } from '@testing-library/react';

const mockFetchImages = jest.fn();
const mockDownloadImage = jest.fn();
const mockSave = jest.fn();
const mockSaveProduct = jest.fn();
const mockLoadProduct = jest.fn();
const mockSplice = jest.fn();
const mockInvalidate = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();
const mockModalProps = jest.fn();

jest.mock('@shared/api/wp', () => ({
	downloadImage: (...args) => mockDownloadImage(...args),
}));
jest.mock('@shared/lib/unsplash', () => ({
	fetchImages: (...args) => mockFetchImages(...args),
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
	Modal: (props) => {
		mockModalProps(props);
		const { title, onRequestClose, children } = props;
		return (
			<div role="dialog" aria-label={title}>
				<button
					type="button"
					data-testid="modal-close"
					onClick={onRequestClose}
				/>
				{children}
			</div>
		);
	},
	Button: ({ children, onClick, disabled, variant }) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
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
	SearchControl: ({ value, onChange, placeholder, disabled }) => (
		<input
			type="search"
			aria-label="Search Unsplash"
			placeholder={placeholder}
			value={value || ''}
			onChange={(e) => onChange(e.target.value)}
			disabled={disabled}
		/>
	),
}));

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

const sampleImage = (id) => ({
	id,
	urls: {
		small: `https://images.unsplash.test/${id}-s.jpg`,
		regular: `https://images.unsplash.test/${id}-r.jpg`,
	},
	alt_description: `alt-${id}`,
	requestMetadata: { id: `req-${id}` },
	user: {
		name: 'Photographer Name',
		links: { html: 'https://unsplash.test/u' },
	},
});

const importComponent = () =>
	require('@quick-edit/components/modals/UnsplashImagePickerModal');

const flush = () =>
	act(async () => {
		await Promise.resolve();
	});

beforeEach(() => {
	jest.clearAllMocks();
	jest.useFakeTimers();
	document.body.innerHTML = '';
	window.extSharedData = {
		...(window.extSharedData || {}),
		siteProfile: { imageSearchTerms: ['mountain lakes'] },
	};
});

afterEach(() => {
	jest.useRealTimers();
});

describe('UnsplashImagePickerModal — body-open class', () => {
	it("overrides bodyOpenClassName so WP Modal doesn't toggle body.modal-open on mount", async () => {
		mockFetchImages.mockResolvedValueOnce([]);
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await flush();
		expect(mockModalProps).toHaveBeenCalledWith(
			expect.objectContaining({
				bodyOpenClassName: 'extendify-quick-edit-modal-open',
			}),
		);
	});
});

describe('UnsplashImagePickerModal — initial fetch', () => {
	it('seeds the query from window.extSharedData.siteProfile.imageSearchTerms[0]', async () => {
		mockFetchImages.mockResolvedValueOnce([sampleImage('a')]);
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await flush();
		expect(mockFetchImages).toHaveBeenCalledWith('mountain lakes', 'user');
	});

	it('falls back to "unsplash" when no seed is configured', async () => {
		window.extSharedData.siteProfile = {};
		mockFetchImages.mockResolvedValueOnce([]);
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await flush();
		expect(mockFetchImages).toHaveBeenCalledWith('unsplash', 'user');
	});

	it('renders a Notice when the load rejects', async () => {
		mockFetchImages.mockRejectedValueOnce(new Error('upstream is down'));
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await flush();
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});
});

describe('UnsplashImagePickerModal — search debounce', () => {
	it('debounces 500ms before refetching with the typed query + emits track', async () => {
		mockFetchImages.mockResolvedValue([]);
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await flush();
		mockFetchImages.mockClear();
		const input = document.querySelector('input[type="search"]');
		fireEvent.change(input, { target: { value: 'sunset' } });
		expect(mockFetchImages).not.toHaveBeenCalled();
		await act(async () => {
			jest.advanceTimersByTime(500);
			await Promise.resolve();
		});
		expect(mockFetchImages).toHaveBeenCalledWith('sunset', 'user');
		expect(mockTrack).toHaveBeenCalledWith('unsplash_searched', { len: 6 });
	});
});

describe('UnsplashImagePickerModal — pick (post-context happy path)', () => {
	beforeEach(() => {
		mockFetchImages.mockResolvedValue([sampleImage('p1')]);
		mockDownloadImage.mockResolvedValue({
			id: 909,
			url: 'https://wp.test/wp-content/uploads/p1.jpg',
			alt_text: 'a-mountain',
		});
		mockSave.mockResolvedValue({ rendered: '<figure>new</figure>' });
		mockSplice.mockReturnValue(document.createElement('figure'));
	});

	const renderAndPick = async (selected) => {
		const onAfterSave = jest.fn();
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={selected}
				field="image"
				onAfterSave={onAfterSave}
			/>,
		);
		await flush();
		const tile = document.querySelector(
			'.extendify-quick-edit-image-grid-item',
		);
		fireEvent.click(tile);
		await flush();
		return onAfterSave;
	};

	it('calls downloadImage with the unsplash metadata + image-context props', async () => {
		await renderAndPick(baseSelected());
		expect(mockDownloadImage).toHaveBeenCalledWith(
			'req-p1',
			'https://images.unsplash.test/p1-r.jpg',
			'unsplash',
			'p1',
			{ alt: 'alt-p1', caption: '' },
		);
	});

	it('calls save() with the patches envelope carrying the downloaded media', async () => {
		await renderAndPick(baseSelected());
		await waitFor(() => expect(mockSave).toHaveBeenCalled());
		expect(mockSave).toHaveBeenCalledWith({
			source: { kind: 'post', id: 42 },
			blockId: 'b-img',
			blockType: 'core/image',
			patches: [
				{
					fieldKey: 'image',
					value: {
						url: 'https://wp.test/wp-content/uploads/p1.jpg',
						id: 909,
						alt: 'a-mountain',
					},
				},
			],
		});
	});

	it('splices, invalidates cache, pushes the before-image undo, tracks, and resolves true', async () => {
		const sel = baseSelected();
		const onAfterSave = await renderAndPick(sel);
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
		expect(mockTrack).toHaveBeenCalledWith('image_replaced', {
			source: 'unsplash',
		});
		await waitFor(() => expect(onAfterSave).toHaveBeenCalledWith(true));
	});
});

describe('UnsplashImagePickerModal — pick (product-context branch)', () => {
	it('saveProduct + reload; never touches save/splice/invalidate', async () => {
		mockFetchImages.mockResolvedValue([sampleImage('p1')]);
		mockDownloadImage.mockResolvedValue({
			id: 909,
			url: 'https://wp.test/p1.jpg',
			alt_text: '',
		});
		mockLoadProduct.mockResolvedValue({ image_id: 11 });
		mockSaveProduct.mockResolvedValue({});

		const onAfterSave = jest.fn();
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={{
					...baseSelected(),
					source: { kind: 'product', id: 55 },
				}}
				field="image"
				onAfterSave={onAfterSave}
			/>,
		);
		await flush();
		const tile = document.querySelector(
			'.extendify-quick-edit-image-grid-item',
		);
		fireEvent.click(tile);
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
			source: 'unsplash',
			kind: 'product',
		});
		await waitFor(() => expect(onAfterSave).toHaveBeenCalledWith(true));
	});
});

describe('UnsplashImagePickerModal — sad path + close', () => {
	it('downloadImage rejecting tracks save_failed + surfaces the message', async () => {
		mockFetchImages.mockResolvedValue([sampleImage('p1')]);
		mockDownloadImage.mockRejectedValueOnce(new Error('quota exceeded'));
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await flush();
		fireEvent.click(
			document.querySelector('.extendify-quick-edit-image-grid-item'),
		);
		await waitFor(() =>
			expect(mockTrack).toHaveBeenCalledWith('save_failed', {
				kind: 'image',
				source: 'unsplash',
			}),
		);
		expect(document.querySelector('[role="alert"]')?.textContent).toMatch(
			/Sorry, something went wrong/i,
		);
	});

	it('Cancel button calls onAfterSave(false)', async () => {
		mockFetchImages.mockResolvedValue([]);
		const onAfterSave = jest.fn();
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={onAfterSave}
			/>,
		);
		await flush();
		const cancel = Array.from(document.querySelectorAll('button')).find(
			(b) => b.textContent === 'Cancel',
		);
		fireEvent.click(cancel);
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});

// The grid's transient states announce
// politely (errors already speak assertively via WP Notice).
describe('UnsplashImagePickerModal — a11y status regions', () => {
	it('exposes a role="status" loading region while images load', () => {
		mockFetchImages.mockReturnValueOnce(new Promise(() => {}));
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		const status = document.querySelector('[role="status"]');
		expect(status).not.toBeNull();
		expect(status.querySelector('[data-testid="spinner"]')).not.toBeNull();
	});

	it('exposes the empty state as a role="status" region', async () => {
		mockFetchImages.mockResolvedValueOnce([]);
		const { UnsplashImagePickerModal } = importComponent();
		render(
			<UnsplashImagePickerModal
				selected={baseSelected()}
				field="image"
				onAfterSave={jest.fn()}
			/>,
		);
		await flush();
		const empty = document.querySelector('[role="status"]');
		expect(empty?.textContent).toBe('No images found.');
	});
});
