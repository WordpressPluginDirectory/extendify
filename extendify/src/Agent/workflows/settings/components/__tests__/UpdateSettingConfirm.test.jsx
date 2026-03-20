import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateSettingConfirm } from '../UpdateSettingConfirm';

describe('UpdateSettingConfirm — undo on cancel/unmount', () => {
	let header;

	beforeEach(() => {
		header = document.createElement('div');
		header.className = 'wp-block-site-title';
		header.textContent = 'Original Title';
		document.body.appendChild(header);
	});

	afterEach(() => {
		header.remove();
	});

	const inputs = { settingName: 'title', newSettingValue: 'New Title' };

	test('reverts the title when unmounted without confirming', () => {
		const { unmount } = render(
			<UpdateSettingConfirm
				inputs={inputs}
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
			/>,
		);

		expect(header.textContent).toBe('New Title');
		unmount();
		expect(header.textContent).toBe('Original Title');
	});

	test('does not revert the title after confirming', async () => {
		const onConfirm = jest.fn();
		const user = userEvent.setup();

		const { unmount } = render(
			<UpdateSettingConfirm
				inputs={inputs}
				onConfirm={onConfirm}
				onCancel={jest.fn()}
			/>,
		);

		await user.click(screen.getByRole('button', { name: /confirm/i }));
		expect(onConfirm).toHaveBeenCalledWith({
			data: inputs,
			shouldRefreshPage: true,
		});

		unmount();
		expect(header.textContent).toBe('New Title');
	});
});
