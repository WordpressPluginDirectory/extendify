// Net-new helper in the rebuild — mounts a single body-level <div> for
// wp-components portals. The React root is lazy and reused across
// mountModal calls; closeModal tears down both the React root and the
// DOM node and optionally reloads the page.

jest.mock('@wordpress/element', () => {
	const render = jest.fn();
	const unmount = jest.fn();
	const createRoot = jest.fn(() => ({ render, unmount }));
	return {
		createRoot,
		__getRoot: () => ({ render, unmount, createRoot }),
	};
});

let renderFn;
let unmountFn;
let createRootFn;

beforeEach(() => {
	jest.resetModules();
	document.body.innerHTML = '';
	const handles = require('@wordpress/element').__getRoot();
	renderFn = handles.render;
	unmountFn = handles.unmount;
	createRootFn = handles.createRoot;
	renderFn.mockClear();
	unmountFn.mockClear();
	createRootFn.mockClear();
});

describe('mountModal', () => {
	it('creates the body-level root node with id="extendify-quick-edit-modal-root"', async () => {
		const { mountModal } = await import('@quick-edit/lib/modal-root');
		mountModal(<div>hi</div>);
		const node = document.getElementById('extendify-quick-edit-modal-root');
		expect(node).not.toBeNull();
		expect(node.parentElement).toBe(document.body);
	});

	it('calls createRoot once and reuses it across repeated mounts', async () => {
		const { mountModal } = await import('@quick-edit/lib/modal-root');
		mountModal(<div>a</div>);
		mountModal(<div>b</div>);
		mountModal(<div>c</div>);
		expect(createRootFn).toHaveBeenCalledTimes(1);
		expect(renderFn).toHaveBeenCalledTimes(3);
	});

	it('forwards the React element to the root.render call', async () => {
		const { mountModal } = await import('@quick-edit/lib/modal-root');
		const element = <span data-x="1">hi</span>;
		mountModal(element);
		expect(renderFn).toHaveBeenCalledWith(element);
	});

	it('re-creates the node when it was removed from the DOM externally', async () => {
		const { mountModal } = await import('@quick-edit/lib/modal-root');
		mountModal(<div>a</div>);
		document.getElementById('extendify-quick-edit-modal-root').remove();
		mountModal(<div>b</div>);
		expect(
			document.getElementById('extendify-quick-edit-modal-root'),
		).not.toBeNull();
	});
});

describe('closeModal', () => {
	it('unmounts the React root and removes the DOM node when no reload arg is passed', async () => {
		const { mountModal, closeModal } = await import(
			'@quick-edit/lib/modal-root'
		);
		mountModal(<div>hi</div>);
		closeModal();
		expect(unmountFn).toHaveBeenCalledTimes(1);
		expect(
			document.getElementById('extendify-quick-edit-modal-root'),
		).toBeNull();
	});

	// closeModal(true) → window.location.reload() is one trivial line that
	// jsdom can't drive without monkey-patching a non-configurable Location.
	// reload-flows.spec.ts E2E covers the reload-after-save path.

	it('is safe to call when nothing was mounted', async () => {
		const { closeModal } = await import('@quick-edit/lib/modal-root');
		expect(() => closeModal()).not.toThrow();
	});

	it('drops the React root reference so the next mountModal creates a fresh one', async () => {
		const { mountModal, closeModal } = await import(
			'@quick-edit/lib/modal-root'
		);
		mountModal(<div>a</div>);
		closeModal();
		mountModal(<div>b</div>);
		expect(createRootFn).toHaveBeenCalledTimes(2);
	});
});
