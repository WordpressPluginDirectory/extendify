import { render } from '@testing-library/react';
import { UpdateSiteIconConfirm } from '../UpdateSiteIconConfirm';

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

describe('UpdateSiteIconConfirm — undo on cancel/unmount', () => {
	let iconLink;

	beforeEach(() => {
		iconLink = document.createElement('link');
		iconLink.rel = 'icon';
		iconLink.href = 'http://example.com/original-icon.png';
		document.head.appendChild(iconLink);
	});

	afterEach(() => {
		iconLink.remove();
	});

	test('restores original icon href on unmount without confirming', () => {
		const { unmount } = render(
			<UpdateSiteIconConfirm onConfirm={jest.fn()} onCancel={jest.fn()} />,
		);
		// Simulate a selection changing the icon
		iconLink.href = 'http://example.com/new-icon.png';
		unmount();
		expect(iconLink.href).toBe('http://example.com/original-icon.png');
	});

	test('does not restore icon after confirming', async () => {
		const onConfirm = jest.fn();
		const { unmount, getByText } = render(
			<UpdateSiteIconConfirm onConfirm={onConfirm} onCancel={jest.fn()} />,
		);
		iconLink.href = 'http://example.com/new-icon.png';
		const saveBtn = getByText('Save');
		saveBtn.click();
		await Promise.resolve();
		unmount();
		expect(iconLink.href).toBe('http://example.com/new-icon.png');
	});
});
