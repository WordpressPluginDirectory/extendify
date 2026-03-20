import { render } from '@testing-library/react';
import { UpdateLogoConfirm } from '../UpdateLogoConfirm';

jest.mock('@agent/components/ImageUploader', () => ({
	ImageUploader: ({ onSave, onCancel }) => (
		<div>
			<button type="button" onClick={() => onSave({ imageId: 1 })}>
				Save
			</button>
			<button type="button" onClick={onCancel}>
				Cancel
			</button>
		</div>
	),
}));
jest.mock('@agent/state/workflows', () => ({
	useWorkflowStore: () => ({ block: { id: 'logo-1' } }),
}));

describe('UpdateLogoConfirm — undo on cancel/unmount', () => {
	let logoImg;

	beforeEach(() => {
		const logoWrapper = document.createElement('div');
		logoWrapper.className = 'wp-block-site-logo';
		logoImg = document.createElement('img');
		logoImg.src = 'http://example.com/original-logo.png';
		logoWrapper.appendChild(logoImg);
		document.body.appendChild(logoWrapper);
	});

	afterEach(() => {
		document.querySelector('.wp-block-site-logo')?.remove();
	});

	test('restores original logo src on unmount without confirming', () => {
		const { unmount } = render(
			<UpdateLogoConfirm onConfirm={jest.fn()} onCancel={jest.fn()} />,
		);
		// Simulate a selection changing the logo
		logoImg.src = 'http://example.com/new-logo.png';
		unmount();
		expect(logoImg.src).toBe('http://example.com/original-logo.png');
	});

	test('does not restore logo after confirming', async () => {
		const onConfirm = jest.fn();
		const { unmount, getByText } = render(
			<UpdateLogoConfirm onConfirm={onConfirm} onCancel={jest.fn()} />,
		);
		logoImg.src = 'http://example.com/new-logo.png';
		const saveBtn = getByText('Save');
		saveBtn.click();
		await Promise.resolve(); // flush async onConfirm
		unmount();
		// Should not have restored because confirmed was set
		expect(logoImg.src).toBe('http://example.com/new-logo.png');
	});
});
