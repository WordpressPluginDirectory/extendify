import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdatePostConfirm } from '../UpdatePostConfirm';

describe('UpdatePostConfirm — undo on cancel/unmount', () => {
	let textNode;

	beforeEach(() => {
		const el = document.createElement('p');
		el.textContent = 'Hello World';
		document.body.appendChild(el);
		textNode = el;
	});

	afterEach(() => {
		textNode.remove();
	});

	const inputs = {
		replacements: [{ original: 'Hello', updated: 'Goodbye' }],
	};

	test('applies text replacements on render', () => {
		render(
			<UpdatePostConfirm
				inputs={inputs}
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
				onRetry={jest.fn()}
			/>,
		);
		expect(textNode.textContent).toBe('Goodbye World');
	});

	test('reverts text replacements when unmounted without confirming', () => {
		const { unmount } = render(
			<UpdatePostConfirm
				inputs={inputs}
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
				onRetry={jest.fn()}
			/>,
		);
		expect(textNode.textContent).toBe('Goodbye World');
		unmount();
		expect(textNode.textContent).toBe('Hello World');
	});

	test('does not revert after confirming', async () => {
		const onConfirm = jest.fn();
		const user = userEvent.setup();
		const { unmount } = render(
			<UpdatePostConfirm
				inputs={inputs}
				onConfirm={onConfirm}
				onCancel={jest.fn()}
				onRetry={jest.fn()}
			/>,
		);
		await user.click(screen.getByRole('button', { name: /save/i }));
		expect(onConfirm).toHaveBeenCalled();
		unmount();
		expect(textNode.textContent).toBe('Goodbye World');
	});
});
