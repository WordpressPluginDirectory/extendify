import { uploadMedia } from '@wordpress/media-utils';
import { getFilename } from '@wordpress/url';
import { getOption, updateOption } from '@launch/api/WPApi';
import { uploadLogo } from '@launch/lib/logo';

// Mock the dependencies
jest.mock('@wordpress/media-utils', () => ({
	uploadMedia: jest.fn(),
}));

jest.mock('@wordpress/url', () => ({
	getFilename: jest.fn(),
}));

jest.mock('@launch/api/WPApi', () => ({
	getOption: jest.fn(),
	updateOption: jest.fn(),
}));

describe('uploadLogo', () => {
	// Setup and teardown
	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks();

		// Mock the fetch function
		global.fetch = jest.fn();
		global.File = class File {
			constructor(bits, name, options) {
				this.bits = bits;
				this.name = name;
				this.type = options?.type || '';
			}
		};
	});

	afterEach(() => {
		// Restore fetch after each test
		global.fetch.mockRestore();
		delete global.File;
	});

	it('should not upload logo if one already exists', async () => {
		// Mock existing logo
		getOption.mockResolvedValue('123');

		await uploadLogo('https://example.com/logo.png');

		// Verify getOption was called
		expect(getOption).toHaveBeenCalledWith('site_logo');

		// Verify no other operations were performed
		expect(global.fetch).not.toHaveBeenCalled();
		expect(uploadMedia).not.toHaveBeenCalled();
		expect(updateOption).not.toHaveBeenCalled();
	});

	it('should handle fetch errors gracefully', async () => {
		// Mock no existing logo
		getOption.mockResolvedValue('0');

		// Mock fetch failure
		global.fetch.mockResolvedValue({
			ok: false,
			text: () => Promise.resolve('Not found'),
		});

		console.error = jest.fn();

		await uploadLogo('https://example.com/logo.png');

		// Verify error was logged
		expect(console.error).toHaveBeenCalled();
		expect(uploadMedia).not.toHaveBeenCalled();
	});

	it('should successfully upload a logo when none exists', async () => {
		// Mock no existing logo
		getOption.mockResolvedValue('0');

		// Mock successful fetch
		const mockBlob = new Blob(['test'], { type: 'image/png' });
		global.fetch.mockResolvedValue({
			ok: true,
			blob: () => Promise.resolve(mockBlob),
		});

		// Mock filename extraction
		getFilename.mockReturnValue('logo.png');

		// Mock successful media upload
		uploadMedia.mockImplementation(({ onFileChange }) => {
			onFileChange([{ id: '456' }]);
			return Promise.resolve();
		});

		await uploadLogo('https://example.com/logo.png');

		// Verify the workflow
		expect(getOption).toHaveBeenCalledWith('site_logo');
		expect(global.fetch).toHaveBeenCalledWith('https://example.com/logo.png');
		expect(getFilename).toHaveBeenCalledWith('https://example.com/logo.png');
		expect(uploadMedia).toHaveBeenCalled();
		expect(updateOption).toHaveBeenCalledWith('site_logo', '456');
	});

	it('should use default name if getFilename returns nothing', async () => {
		// Mock no existing logo
		getOption.mockResolvedValue('0');

		// Mock successful fetch
		const mockBlob = new Blob(['test'], { type: 'image/png' });
		global.fetch.mockResolvedValue({
			ok: true,
			blob: () => Promise.resolve(mockBlob),
		});

		// Mock no filename returned
		getFilename.mockReturnValue(null);

		// Spy on File constructor
		const originalFile = global.File;
		global.File = jest.fn(function (bits, name, options) {
			return new originalFile(bits, name, options);
		});

		// Mock successful media upload
		uploadMedia.mockImplementation(({ onFileChange }) => {
			onFileChange([{ id: '456' }]);
			return Promise.resolve();
		});

		await uploadLogo('https://example.com/logo');

		// Verify default name was used
		expect(global.File).toHaveBeenCalledWith(
			expect.anything(),
			'default-logo.png',
			expect.anything(),
		);
	});

	it('should handle upload errors gracefully', async () => {
		// Mock no existing logo
		getOption.mockResolvedValue('0');

		// Mock successful fetch
		const mockBlob = new Blob(['test'], { type: 'image/png' });
		global.fetch.mockResolvedValue({
			ok: true,
			blob: () => Promise.resolve(mockBlob),
		});

		// Mock error in upload
		console.error = jest.fn();
		uploadMedia.mockImplementation(({ onError }) => {
			onError(new Error('Upload failed'));
			return Promise.resolve();
		});

		await uploadLogo('https://example.com/logo.png');

		// Verify error was handled
		expect(console.error).toHaveBeenCalled();
	});
});
