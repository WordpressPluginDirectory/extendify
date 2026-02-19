const adminUrl = 'https://wordpress.test/wp-admin/';
const homeUrl = 'https://wordpress.test/';

let getRedirectUrl;

beforeEach(async () => {
	jest.resetModules();
	window.extSharedData = { adminUrl, homeUrl };
	window.extAgentData = {
		agentContext: {
			pluginRecommendations: [
				{
					slug: 'woocommerce',
					redirectTo: 'https://wordpress.test/wp-admin/admin.php?page=wc-setup',
				},
				{
					slug: 'no-redirect',
					redirectTo: '',
				},
			],
		},
	};
	const mod = await import('../redirects');
	getRedirectUrl = mod.getRedirectUrl;
});

describe('getRedirectUrl', () => {
	it('returns a full URL for a valid plugin-setup redirect', () => {
		const result = getRedirectUrl(
			{ type: 'plugin-setup' },
			{ pluginSlug: 'woocommerce' },
		);
		expect(result).toBe(
			'https://wordpress.test/wp-admin/admin.php?page=wc-setup',
		);
	});

	it('returns empty when redirectTo is falsy', () => {
		expect(getRedirectUrl(null, {})).toBe('');
		expect(getRedirectUrl(undefined, {})).toBe('');
		expect(getRedirectUrl('', {})).toBe('');
	});

	it('returns empty for an unknown redirect type', () => {
		const result = getRedirectUrl(
			{ type: 'unknown' },
			{ pluginSlug: 'woocommerce' },
		);
		expect(result).toBe('');
	});

	it('returns empty when plugin slug is not in recommendations', () => {
		const result = getRedirectUrl(
			{ type: 'plugin-setup' },
			{ pluginSlug: 'nonexistent' },
		);
		expect(result).toBe('');
	});

	it('returns empty when plugin has no redirectTo value', () => {
		const result = getRedirectUrl(
			{ type: 'plugin-setup' },
			{ pluginSlug: 'no-redirect' },
		);
		expect(result).toBe('');
		expect(console).toHaveErrored();
	});
});
