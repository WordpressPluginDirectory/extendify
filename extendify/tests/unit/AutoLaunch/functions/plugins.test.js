import apiFetch from '@wordpress/api-fetch';

jest.mock('@wordpress/api-fetch');
jest.mock('@shared/api/DataApi', () => ({ recordPluginActivity: jest.fn() }));
jest.mock('@shared/api/wp', () => ({ enableAutoUpdate: jest.fn() }));

const { activatePlugin } = require('@auto-launch/functions/plugins');

describe('activatePlugin', () => {
	beforeEach(() => {
		apiFetch.mockReset();
	});

	// Regression: when a required plugin 500s during install it never lands on
	// disk, so the activate retry's getPlugin lookup comes back empty. The old
	// code destructured `{ plugin }` off that undefined and threw a TypeError
	// out of the catch as an unhandled rejection, aborting the install loop.
	it('resolves without throwing when the plugin is not installed', async () => {
		apiFetch.mockImplementation((opts) =>
			opts.method === 'POST'
				? Promise.reject(new Error('500'))
				: Promise.resolve([]),
		);

		await expect(activatePlugin('jetbackup')).resolves.toBeUndefined();
		expect(console).toHaveWarned();
		expect(console).toHaveErrored();
	});

	it('retries activation against the resolved plugin path when found', async () => {
		apiFetch.mockImplementation((opts) => {
			if (opts.method !== 'POST') {
				return Promise.resolve([{ plugin: 'jetbackup/jetbackup.php' }]);
			}
			// The bare-slug attempt fails; the resolved-path retry succeeds.
			return opts.path === '/wp/v2/plugins/jetbackup'
				? Promise.reject(new Error('400'))
				: Promise.resolve();
		});

		await expect(activatePlugin('jetbackup')).resolves.toBeUndefined();
		expect(apiFetch).toHaveBeenCalledWith(
			expect.objectContaining({
				path: '/wp/v2/plugins/jetbackup/jetbackup.php',
				method: 'POST',
			}),
		);
		expect(console).toHaveWarned();
	});
});
