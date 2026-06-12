// InlineEditor is the orchestrator: it reads `selected` from the
// QuickEdit store and dispatches to one of three branches —
// (a) text blocks → BlockTextEditor,
// (b) image blocks → ImagePicker (inline menu),
// (c) modal block types → mountModal(<TheRightModal …/>).
// Tests pin the routing decision per block type, the props handed to each
// modal, and the onAfterSave reload-on-true contract.

import { render } from '@testing-library/react';

const mockMountModal = jest.fn();
const mockCloseModal = jest.fn();
const mockClearSelected = jest.fn();
let mockSelected = null;

jest.mock('@quick-edit/lib/api', () => ({
	loadProduct: jest.fn(),
	save: jest.fn(),
	saveProduct: jest.fn(),
}));
jest.mock('@quick-edit/lib/block-source-cache', () => ({
	invalidateBlockSource: jest.fn(),
}));
jest.mock('@quick-edit/lib/dom', () => ({
	splice: jest.fn(),
}));
jest.mock('@quick-edit/lib/insights', () => ({
	track: jest.fn(),
}));
jest.mock('@quick-edit/lib/modal-root', () => ({
	mountModal: (...args) => mockMountModal(...args),
	closeModal: (...args) => mockCloseModal(...args),
}));
jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: (selector) =>
		selector({ selected: mockSelected, clearSelected: mockClearSelected }),
}));
jest.mock('@quick-edit/state/undo', () => ({
	pushUndo: jest.fn(),
}));

jest.mock('@quick-edit/components/BlockTextEditor', () => ({
	BlockTextEditor: (props) => (
		<div
			data-testid="block-text-editor"
			data-block-type={props.selected.blockType}
		/>
	),
}));

const stubModal = (name) => (props) => (
	<div
		data-testid={name}
		data-props={JSON.stringify(
			Object.fromEntries(
				Object.entries(props).filter(([, v]) => typeof v !== 'function'),
			),
		)}
	/>
);

jest.mock('@quick-edit/components/modals/AiImagePickerModal', () => ({
	AiImagePickerModal: stubModal('AiImagePickerModal'),
}));
jest.mock('@quick-edit/components/modals/NavItemModal', () => ({
	NavItemModal: stubModal('NavItemModal'),
}));
jest.mock('@quick-edit/components/modals/ProductPriceModal', () => ({
	ProductPriceModal: stubModal('ProductPriceModal'),
}));
jest.mock('@quick-edit/components/modals/ProductTextModal', () => ({
	ProductTextModal: stubModal('ProductTextModal'),
}));
jest.mock('@quick-edit/components/modals/SiteIdentityModal', () => ({
	SiteIdentityModal: stubModal('SiteIdentityModal'),
}));
jest.mock('@quick-edit/components/modals/SocialLinkModal', () => ({
	SocialLinkModal: stubModal('SocialLinkModal'),
}));
jest.mock('@quick-edit/components/modals/UnsplashImagePickerModal', () => ({
	UnsplashImagePickerModal: stubModal('UnsplashImagePickerModal'),
}));
jest.mock('@quick-edit/components/modals/WPFormsFieldModal', () => ({
	WPFormsFieldModal: stubModal('WPFormsFieldModal'),
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockSelected = null;
	document.body.innerHTML = '';
});

const importComponent = () => require('@quick-edit/components/InlineEditor');

const renderWithSelected = (sel) => {
	mockSelected = sel;
	const { InlineEditor } = importComponent();
	return render(<InlineEditor />);
};

const mountedElement = () => {
	expect(mockMountModal).toHaveBeenCalledTimes(1);
	return mockMountModal.mock.calls[0][0];
};

describe('InlineEditor — null selection', () => {
	it('renders nothing and mounts no modal when selected is null', () => {
		const { container } = renderWithSelected(null);
		expect(container.firstChild).toBeNull();
		expect(mockMountModal).not.toHaveBeenCalled();
	});
});

describe('InlineEditor — text routing (TEXT_STRATEGIES)', () => {
	const cases = ['core/paragraph', 'core/heading', 'core/button'];
	for (const blockType of cases) {
		it(`renders BlockTextEditor for ${blockType}`, () => {
			const { getByTestId } = renderWithSelected({
				blockType,
				blockId: 'b-1',
				el: document.createElement('p'),
				source: { kind: 'post', id: 1 },
			});
			expect(
				getByTestId('block-text-editor').getAttribute('data-block-type'),
			).toBe(blockType);
			expect(mockMountModal).not.toHaveBeenCalled();
		});
	}
});

describe('InlineEditor — image routing (PICKER_STRATEGIES)', () => {
	const cases = ['core/image', 'core/cover', 'product:image'];
	for (const blockType of cases) {
		it(`renders the ImagePicker menu for ${blockType} (no modal mount)`, () => {
			renderWithSelected({
				blockType,
				blockId: 'b-img',
				el: document.createElement('div'),
				source: { kind: 'post', id: 1 },
			});
			expect(
				document.getElementById('extendify-quick-edit-image-menu'),
			).not.toBeNull();
			expect(mockMountModal).not.toHaveBeenCalled();
		});
	}
});

describe('InlineEditor — image menu drops from the hover bar', () => {
	// positionBar (lib/hover-bar.js) places the pill above OR below the image
	// depending on viewport room and leaves it mounted for picker blocks. The
	// menu must follow the pill, not assume it sits at the image's top edge.
	const rect = (top, bottom, left = 400, width = 200) => ({
		top,
		bottom,
		left,
		right: left + width,
		width,
		height: bottom - top,
	});
	const imageEl = (r) => {
		const el = document.createElement('div');
		el.getBoundingClientRect = () => r;
		return el;
	};
	const mountBar = (r) => {
		const bar = document.createElement('div');
		bar.className = 'extendify-quick-edit-bar';
		bar.getBoundingClientRect = () => r;
		document.body.appendChild(bar);
	};

	beforeEach(() => {
		Object.defineProperty(window, 'innerWidth', {
			value: 1280,
			configurable: true,
		});
		Object.defineProperty(window, 'innerHeight', {
			value: 900,
			configurable: true,
		});
	});

	it('drops below the pill when the bar sits below the image', () => {
		mountBar(rect(608, 644)); // pill pushed below a top-anchored image
		renderWithSelected({
			blockType: 'core/image',
			blockId: 'b-below',
			el: imageEl(rect(40, 600, 300, 600)),
			source: { kind: 'post', id: 1 },
		});
		const menu = document.getElementById('extendify-quick-edit-image-menu');
		// bar.bottom (644) + GAP (6) — NOT the image's top edge (40).
		expect(menu.style.top).toBe('650px');
	});

	it('drops just under the pill when the bar sits above the image', () => {
		mountBar(rect(256, 292));
		renderWithSelected({
			blockType: 'core/image',
			blockId: 'b-above',
			el: imageEl(rect(300, 700, 300, 600)),
			source: { kind: 'post', id: 1 },
		});
		const menu = document.getElementById('extendify-quick-edit-image-menu');
		expect(menu.style.top).toBe('298px'); // 292 + 6
	});

	it('falls back to the image top edge when no bar is mounted', () => {
		renderWithSelected({
			blockType: 'core/image',
			blockId: 'b-nobar',
			el: imageEl(rect(120, 520, 300, 600)),
			source: { kind: 'post', id: 1 },
		});
		const menu = document.getElementById('extendify-quick-edit-image-menu');
		expect(menu.style.top).toBe('120px');
	});
});

describe('InlineEditor — modal routing (MODAL_BLOCK_TYPES)', () => {
	it('site-title → SiteIdentityModal with kind="title"', () => {
		renderWithSelected({ blockType: 'core/site-title' });
		const el = mountedElement();
		expect(el.props.kind).toBe('title');
	});

	it('site-tagline → SiteIdentityModal with kind="tagline"', () => {
		renderWithSelected({ blockType: 'core/site-tagline' });
		const el = mountedElement();
		expect(el.props.kind).toBe('tagline');
	});

	it('site-logo → SiteIdentityModal with kind="logo"', () => {
		renderWithSelected({ blockType: 'core/site-logo' });
		const el = mountedElement();
		expect(el.props.kind).toBe('logo');
	});

	it('social-link → SocialLinkModal carrying the selection', () => {
		const sel = { blockType: 'core/social-link', blockId: 'sl-1' };
		renderWithSelected(sel);
		const el = mountedElement();
		expect(el.props.selected).toBe(sel);
	});

	it('navigation-link → NavItemModal', () => {
		const sel = { blockType: 'core/navigation-link', blockId: 'n-1' };
		renderWithSelected(sel);
		const el = mountedElement();
		expect(el.props.selected).toBe(sel);
	});

	it('navigation-submenu also routes to NavItemModal', () => {
		const sel = { blockType: 'core/navigation-submenu', blockId: 'n-2' };
		renderWithSelected(sel);
		const el = mountedElement();
		expect(el.props.selected).toBe(sel);
	});

	it('product:name → ProductTextModal with productId + productField', () => {
		renderWithSelected({
			blockType: 'product:name',
			productId: 99,
			productField: 'name',
		});
		const el = mountedElement();
		expect(el.props.productId).toBe(99);
		expect(el.props.field).toBe('name');
	});

	it('product:short_description → ProductTextModal with productId + productField', () => {
		renderWithSelected({
			blockType: 'product:short_description',
			productId: 99,
			productField: 'short_description',
		});
		const el = mountedElement();
		expect(el.props.productId).toBe(99);
		expect(el.props.field).toBe('short_description');
	});

	it('product:price → ProductPriceModal with productId', () => {
		renderWithSelected({ blockType: 'product:price', productId: 7 });
		const el = mountedElement();
		expect(el.props.productId).toBe(7);
	});

	it('wpforms:field → WPFormsFieldModal with formId + fieldId', () => {
		renderWithSelected({
			blockType: 'wpforms:field',
			formId: 12,
			fieldId: 'field-3',
		});
		const el = mountedElement();
		expect(el.props.formId).toBe(12);
		expect(el.props.fieldId).toBe('field-3');
	});

	it('routes nothing through BlockTextEditor or the image menu while a modal is active', () => {
		const { container } = renderWithSelected({
			blockType: 'core/site-title',
		});
		expect(container.firstChild).toBeNull();
		expect(
			document.getElementById('extendify-quick-edit-image-menu'),
		).toBeNull();
	});
});

describe('InlineEditor — modal onAfterSave reload contract', () => {
	// jsdom locks window.location.reload (configurable: false, writable: false),
	// same wrinkle the undo test calls out. Spy on console.error so the jsdom
	// "Not implemented: navigation" log doesn't trip @wordpress/jest-console,
	// then key off whether that log appeared to detect the reload call.
	let errorSpy;
	beforeEach(() => {
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		errorSpy.mockRestore();
	});

	const navigationLogged = () =>
		errorSpy.mock.calls.some((c) =>
			c.some((arg) => String(arg).includes('Not implemented: navigation')),
		);

	it('onAfterSave(true) closes the modal, clears selection, then attempts reload', () => {
		renderWithSelected({ blockType: 'core/site-title' });
		const el = mountedElement();
		el.props.onAfterSave(true);
		expect(mockCloseModal).toHaveBeenCalledWith(false);
		expect(mockClearSelected).toHaveBeenCalledTimes(1);
		expect(navigationLogged()).toBe(true);
	});

	it('onAfterSave(false) closes the modal + clears selection but skips reload', () => {
		renderWithSelected({ blockType: 'core/site-title' });
		const el = mountedElement();
		el.props.onAfterSave(false);
		expect(mockCloseModal).toHaveBeenCalledWith(false);
		expect(mockClearSelected).toHaveBeenCalledTimes(1);
		expect(navigationLogged()).toBe(false);
	});
});

describe('InlineEditor — modal unmount cleanup', () => {
	it('unmount closes any active modal (closeModal(false))', () => {
		const { unmount } = renderWithSelected({ blockType: 'core/site-title' });
		expect(mockCloseModal).not.toHaveBeenCalled();
		unmount();
		expect(mockCloseModal).toHaveBeenCalledWith(false);
	});
});

describe('InlineEditor — unsupported block type', () => {
	it('renders the UnsupportedNotice error pill with the block type', () => {
		renderWithSelected({
			blockType: 'core/something-weird',
			el: document.createElement('div'),
		});
		expect(document.body.textContent).toContain('core/something-weird');
		expect(mockMountModal).not.toHaveBeenCalled();
	});

	// The error pill announces assertively
	// and its × dismiss control carries an accessible name.
	it('error pill is role="alert" with an accessible Dismiss button', () => {
		renderWithSelected({
			blockType: 'core/something-weird',
			el: document.createElement('div'),
		});
		const pill = document.querySelector('[role="alert"]');
		expect(pill).not.toBeNull();
		expect(pill.querySelector('button').getAttribute('aria-label')).toBe(
			'Dismiss',
		);
	});
});
