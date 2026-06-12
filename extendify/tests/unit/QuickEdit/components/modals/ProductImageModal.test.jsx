// ProductImageModal opens a wp.media frame on mount, then on selection writes
// the picked attachment id through saveProduct({ field: 'image' }) and reloads.
// It returns null — no own DOM. Tests pin the frame wiring + save/undo contract
// plus the missing-wp.media short-circuit.

import { act, render } from '@testing-library/react';

const mockLoadProduct = jest.fn();
const mockSaveProduct = jest.fn();
const mockTrack = jest.fn();
const mockPushUndo = jest.fn();

jest.mock('@quick-edit/lib/api', () => ({
	loadProduct: (...args) => mockLoadProduct(...args),
	saveProduct: (...args) => mockSaveProduct(...args),
}));
jest.mock('@quick-edit/lib/insights', () => ({
	track: (...args) => mockTrack(...args),
}));
jest.mock('@quick-edit/state/undo', () => ({
	pushUndo: (...args) => mockPushUndo(...args),
}));

const importComponent = () =>
	require('@quick-edit/components/modals/ProductImageModal');

const makeFrame = ({ selectionId = 99 } = {}) => {
	const handlers = {};
	const classes = new Set();
	const $modal = {
		__classes: classes,
		addClass: jest.fn((c) => classes.add(c)),
		removeClass: jest.fn((c) => classes.delete(c)),
		hasClass: (c) => classes.has(c),
	};
	return {
		__handlers: handlers,
		__$modal: $modal,
		modal: { $el: $modal },
		on: jest.fn((evt, cb) => {
			handlers[evt] = handlers[evt] || [];
			handlers[evt].push(cb);
		}),
		open: jest.fn(),
		content: { mode: jest.fn() },
		state: () => ({
			get: () => ({
				first: () => ({
					toJSON: () => ({ id: selectionId }),
				}),
			}),
		}),
	};
};

const fire = (frame, evt) => {
	for (const cb of frame.__handlers[evt] || []) {
		cb();
	}
};

beforeEach(() => {
	jest.clearAllMocks();
	document.body.className = '';
});

afterEach(() => {
	delete window.wp;
});

describe('ProductImageModal — wp.media missing', () => {
	it('calls onAfterSave(false) immediately when window.wp.media is undefined', () => {
		delete window.wp;
		const onAfterSave = jest.fn();
		const { ProductImageModal } = importComponent();
		render(<ProductImageModal productId={9} onAfterSave={onAfterSave} />);
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});

describe('ProductImageModal — frame lifecycle', () => {
	let frame;
	beforeEach(() => {
		frame = makeFrame();
		window.wp = { media: jest.fn(() => frame) };
		mockLoadProduct.mockResolvedValue({ image_id: 11 });
	});

	it('constructs the wp.media frame with image-library config + opens it', () => {
		const { ProductImageModal } = importComponent();
		render(<ProductImageModal productId={7} onAfterSave={jest.fn()} />);
		expect(window.wp.media).toHaveBeenCalledWith(
			expect.objectContaining({
				library: { type: 'image' },
				multiple: false,
			}),
		);
		expect(frame.open).toHaveBeenCalled();
	});

	it('prefetches the current image id for the undo before-state', () => {
		const { ProductImageModal } = importComponent();
		render(<ProductImageModal productId={7} onAfterSave={jest.fn()} />);
		expect(mockLoadProduct).toHaveBeenCalledWith(7);
	});

	it('toggles class extendify-quick-edit-mode-browse on frame.modal.$el (NOT body) on open / close', () => {
		// Round-5 #2: the class lives on the modal element so other
		// wp.media frames (the AI Agent's "Change image" picker) don't
		// inherit QE's chrome-hiding CSS and blank out.
		const { ProductImageModal } = importComponent();
		render(<ProductImageModal productId={7} onAfterSave={jest.fn()} />);
		fire(frame, 'open');
		expect(frame.__$modal.hasClass('extendify-quick-edit-mode-browse')).toBe(
			true,
		);
		expect(
			document.body.classList.contains('extendify-quick-edit-mode-browse'),
		).toBe(false);
		fire(frame, 'close');
		expect(frame.__$modal.hasClass('extendify-quick-edit-mode-browse')).toBe(
			false,
		);
	});
});

describe('ProductImageModal — select', () => {
	let frame;
	let onAfterSave;

	beforeEach(() => {
		frame = makeFrame({ selectionId: 909 });
		window.wp = { media: jest.fn(() => frame) };
		mockLoadProduct.mockResolvedValue({ image_id: 11 });
		mockSaveProduct.mockResolvedValue({});
		onAfterSave = jest.fn();
	});

	const triggerSelect = async () => {
		const { ProductImageModal } = importComponent();
		render(<ProductImageModal productId={7} onAfterSave={onAfterSave} />);
		// flush the prefetch promise before driving select
		await act(async () => {});
		await act(async () => {
			for (const cb of frame.__handlers.select || []) await cb();
		});
	};

	it('calls saveProduct({ productId, field: "image", value: id })', async () => {
		await triggerSelect();
		expect(mockSaveProduct).toHaveBeenCalledWith({
			productId: 7,
			field: 'image',
			value: 909,
		});
		expect(onAfterSave).toHaveBeenCalledWith(true);
		expect(mockTrack).toHaveBeenCalledWith('save', {
			kind: 'product',
			field: 'image',
		});
	});

	it('pushes a product-image undo when the before id differed', async () => {
		await triggerSelect();
		expect(mockPushUndo).toHaveBeenCalledWith({
			kind: 'product-image',
			productReplay: true,
			productId: 7,
			field: 'image',
			beforeValue: 11,
		});
	});

	it('skips the undo push when the before id matched the new id', async () => {
		mockLoadProduct.mockResolvedValueOnce({ image_id: 909 });
		await triggerSelect();
		expect(mockPushUndo).not.toHaveBeenCalled();
	});

	it('saveProduct rejecting → onAfterSave(false) + save_failed track', async () => {
		mockSaveProduct.mockRejectedValueOnce(new Error('boom'));
		await triggerSelect();
		expect(onAfterSave).toHaveBeenCalledWith(false);
		expect(mockTrack).toHaveBeenCalledWith('save_failed', {
			kind: 'product',
			field: 'image',
		});
	});

	it('closing the frame without picking → onAfterSave(false)', () => {
		const { ProductImageModal } = importComponent();
		render(<ProductImageModal productId={7} onAfterSave={onAfterSave} />);
		fire(frame, 'close');
		expect(onAfterSave).toHaveBeenCalledWith(false);
	});
});
