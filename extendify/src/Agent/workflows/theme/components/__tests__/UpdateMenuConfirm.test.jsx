import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateMenuConfirm } from '../UpdateMenuConfirm';

jest.mock('@wordpress/api-fetch', () => ({
	__esModule: true,
	default: jest.fn(() => Promise.resolve('<li>New Menu</li>')),
}));

describe('UpdateMenuConfirm — undo on cancel/unmount', () => {
	let nav;

	beforeEach(() => {
		nav = document.createElement('nav');
		nav.setAttribute('data-extendify-menu-id', 'nav-1');
		nav.innerHTML = '<li>Original Menu</li>';
		document.body.appendChild(nav);
	});

	afterEach(() => {
		nav.remove();
	});

	const inputs = {
		id: 'nav-1',
		replacements: [
			{ original: '<li>Original Menu</li>', updated: '<li>New Menu</li>' },
		],
	};

	test('restores original menu HTML when unmounted without confirming', async () => {
		const { unmount } = render(
			<UpdateMenuConfirm
				inputs={inputs}
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
			/>,
		);
		// apiFetch updates nav asynchronously
		await screen.findByText(/review and confirm/i);
		unmount();
		expect(nav.innerHTML).toBe('<li>Original Menu</li>');
	});

	test('does not restore menu after confirming', async () => {
		const onConfirm = jest.fn();
		const user = userEvent.setup();
		const { unmount } = render(
			<UpdateMenuConfirm
				inputs={inputs}
				onConfirm={onConfirm}
				onCancel={jest.fn()}
			/>,
		);
		await screen.findByText(/review and confirm/i);
		await user.click(screen.getByRole('button', { name: /save/i }));
		expect(onConfirm).toHaveBeenCalled();
		unmount();
		// Menu should NOT be restored since it was confirmed
		expect(nav.innerHTML).not.toBe('<li>Original Menu</li>');
	});
});
