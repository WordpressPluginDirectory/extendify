import { UpdateImageConfirm } from '@agent/workflows/block-selector/components/UpdateImageConfirm';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Stand in for the wp.media frame: opening fires `select` then `close`,
// the same order the real frame uses after a selection.
let mockAttachment;
jest.mock('@wordpress/media-utils', () => ({
	MediaUpload: ({ onSelect, onClose, render }) =>
		render({
			open: () => {
				onSelect(mockAttachment);
				onClose?.();
			},
		}),
}));
let mockAgentBlock;
jest.mock('@quick-edit/state/store', () => ({
	useQuickEditStore: (selector) => selector({ agentBlock: mockAgentBlock }),
}));
jest.mock('@shared/lib/media-views', () => ({
	addCustomMediaViewsCss: jest.fn(),
	removeCustomMediaViewsCss: jest.fn(),
}));
jest.mock('@wordpress/block-library', () => ({
	registerCoreBlocks: jest.fn(),
}));
jest.mock('@wordpress/blocks', () => ({
	getBlockTypes: () => [{ name: 'core/paragraph' }],
	rawHandler: jest.fn(),
	serialize: jest.fn(),
}));

const NEW_IMAGE = {
	id: 99,
	url: 'https://cdn.test/new.jpg',
	source_url: 'https://cdn.test/new.jpg',
};

const renderConfirm = (inputs) =>
	render(
		<UpdateImageConfirm
			inputs={inputs}
			onConfirm={jest.fn()}
			onCancel={jest.fn()}
		/>,
	);

const openLibrary = (user) =>
	user.click(screen.getByRole('button', { name: /open media library/i }));

describe('UpdateImageConfirm — resilient live-image preview', () => {
	let block;

	beforeEach(() => {
		mockAttachment = NEW_IMAGE;
		mockAgentBlock = { id: 'block-1' };
		block = document.createElement('div');
		block.setAttribute('data-extendify-agent-block-id', 'block-1');
		document.body.appendChild(block);
	});

	afterEach(() => block.remove());

	test('swaps the live image when its src diverges from inputs.url (re-encoded commas + extra CDN query params)', async () => {
		// Rendered src is comma-encoded and carries extra query params, so the
		// exact-attribute match the old code relied on never resolves.
		block.innerHTML =
			'<figure><img src="https://cdn.test/photo.jpg?w=800%2Ch=600&auto=format" /></figure>';
		const user = userEvent.setup();
		renderConfirm({
			url: 'https://cdn.test/photo.jpg?w=800,h=600',
			imageId: 42,
			previousContent: '',
		});

		await openLibrary(user);

		expect(block.querySelector('img').getAttribute('src')).toBe(NEW_IMAGE.url);
		expect(await screen.findByText(/review and confirm/i)).toBeInTheDocument();
	});

	test('still advances to confirmation when no live <img> matches (background-image block) — no silent no-op', async () => {
		block.innerHTML =
			'<div class="cover" style="background-image:url(https://cdn.test/photo.jpg)"></div>';
		const user = userEvent.setup();
		renderConfirm({
			url: 'https://cdn.test/photo.jpg',
			imageId: 42,
			previousContent: '',
		});

		await openLibrary(user);

		expect(await screen.findByText(/review and confirm/i)).toBeInTheDocument();
	});

	test('restores the original image on unmount via a descendant <img>, not just a direct child', async () => {
		block.innerHTML =
			'<figure><img src="https://cdn.test/photo.jpg" /></figure>';
		const user = userEvent.setup();
		const { unmount } = renderConfirm({
			url: 'https://cdn.test/photo.jpg',
			imageId: 42,
			previousContent: '',
		});

		await openLibrary(user);
		expect(block.querySelector('img').getAttribute('src')).toBe(NEW_IMAGE.url);

		unmount();
		expect(block.querySelector('img').getAttribute('src')).toBe(
			'https://cdn.test/photo.jpg',
		);
	});
});

// A block-selector confirm is only mounted by a `requires: ['block']` workflow,
// which Agent.jsx cancels before render when nothing is staged — so it should
// never see a null `agentBlock` in the gated flow. This pins the read-site
// null-safety (`block?.id`) directly, so a future workflow that renders the
// confirm without that gate can't crash on it.
describe('UpdateImageConfirm — null-safe with no staged block', () => {
	beforeEach(() => {
		mockAttachment = NEW_IMAGE;
		mockAgentBlock = null;
	});

	test('renders and advances through the picker without an agentBlock', async () => {
		const user = userEvent.setup();
		renderConfirm({
			url: 'https://cdn.test/photo.jpg',
			imageId: 42,
			previousContent: '',
		});

		await openLibrary(user);

		expect(await screen.findByText(/review and confirm/i)).toBeInTheDocument();
	});
});
