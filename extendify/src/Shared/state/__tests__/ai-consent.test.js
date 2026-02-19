// Mock dependencies
jest.mock('@wordpress/api-fetch', () => ({
	__esModule: true,
	default: jest.fn(),
}));
jest.mock('@wordpress/i18n', () => ({
	__: (str) => str,
	sprintf: (format, ...args) => {
		// Simple mock for sprintf to replace %1$s, %2$s etc
		return format.replace('%1$s', args[0] || '').replace('%2$s', args[1] || '');
	},
}));

// Mock zustand middleware to ensure storage logic runs synchronously
jest.mock('zustand/middleware', () => ({
	devtools: (fn) => fn,
	persist: (config, options) => (set, get, api) => {
		const newSet = (args) => {
			set(args);
			if (options?.storage?.setItem) {
				options.storage.setItem(options.name, { state: get() });
			}
		};
		return config(newSet, get, api);
	},
}));

describe('useAIConsentStore', () => {
	let useAIConsentStore;

	// Helper to reload the store module to test initialization logic
	const loadStore = async () => {
		const module = await import('../ai-consent');
		useAIConsentStore = module.useAIConsentStore;
		return useAIConsentStore;
	};

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		window.extSharedData = {};
	});

	describe('Initialization', () => {
		it('initializes with default values when no shared data is present', async () => {
			await loadStore();
			const state = useAIConsentStore.getState();

			expect(state.showAIConsent).toBe(false);
			expect(state.userGaveConsent).toBe(false);
			expect(state.consentTerms).toContain('By using AI features');
		});

		it('initializes with provided shared data', async () => {
			window.extSharedData = {
				showAIConsent: true,
				userGaveConsent: true,
				consentTermsCustom: 'Custom Terms',
			};
			await loadStore();
			const state = useAIConsentStore.getState();

			expect(state.showAIConsent).toBe(true);
			expect(state.userGaveConsent).toBe(true);
			expect(state.consentTerms).toBe('Custom Terms');
		});

		it('uses default terms when consentTermsCustom is an empty string', async () => {
			// This tests the fix where we use || instead of ??
			window.extSharedData = {
				consentTermsCustom: '',
			};
			await loadStore();
			const state = useAIConsentStore.getState();

			expect(state.consentTerms).not.toBe('');
			expect(state.consentTerms).toContain('By using AI features');
		});
	});

	describe('Actions', () => {
		beforeEach(async () => {
			await loadStore();
		});

		it('updates userGaveConsent and triggers API call', () => {
			const { setUserGaveConsent } = useAIConsentStore.getState();
			// apiFetch mock is reset in beforeEach, so we need to get the current instance
			const apiFetch = require('@wordpress/api-fetch').default;

			setUserGaveConsent(true);

			expect(useAIConsentStore.getState().userGaveConsent).toBe(true);

			// Verify persistence call
			expect(apiFetch).toHaveBeenCalledWith({
				path: '/extendify/v1/shared/update-user-meta',
				method: 'POST',
				data: { option: 'ai_consent', value: true },
			});
		});
	});

	describe('shouldShowAIConsent', () => {
		const setState = (vals) => useAIConsentStore.setState(vals);

		beforeEach(async () => {
			await loadStore();
		});

		it('returns falsy if showAIConsent is false', () => {
			setState({ showAIConsent: false, consentTerms: 'Terms' });
			const { shouldShowAIConsent } = useAIConsentStore.getState();
			expect(shouldShowAIConsent('launch')).toBeFalsy();
		});

		it('returns falsy if consentTerms is missing/empty', () => {
			setState({ showAIConsent: true, consentTerms: '' });
			const { shouldShowAIConsent } = useAIConsentStore.getState();
			expect(shouldShowAIConsent('launch')).toBeFalsy();
		});

		it('handles "launch" context', () => {
			setState({
				showAIConsent: true,
				consentTerms: 'Terms',
				userGaveConsent: false,
			});
			const { shouldShowAIConsent } = useAIConsentStore.getState();

			// Launch shows regardless of consent status (as long as enabled)
			expect(shouldShowAIConsent('launch')).toBeTruthy();

			setState({ userGaveConsent: true });
			expect(
				useAIConsentStore.getState().shouldShowAIConsent('launch'),
			).toBeTruthy();
		});

		it('handles "draft" context', () => {
			setState({
				showAIConsent: true,
				consentTerms: 'Terms',
				userGaveConsent: false,
			});
			const { shouldShowAIConsent } = useAIConsentStore.getState();

			// Shows if not consented
			expect(shouldShowAIConsent('draft')).toBeTruthy();

			// Hides if consented
			setState({ userGaveConsent: true });
			expect(
				useAIConsentStore.getState().shouldShowAIConsent('draft'),
			).toBeFalsy();
		});

		it('handles "help-center" context', () => {
			setState({
				showAIConsent: true,
				consentTerms: 'Terms',
				userGaveConsent: false,
			});
			const { shouldShowAIConsent } = useAIConsentStore.getState();

			// Shows if not consented
			expect(shouldShowAIConsent('help-center')).toBeTruthy();

			// Hides if consented
			setState({ userGaveConsent: true });
			expect(
				useAIConsentStore.getState().shouldShowAIConsent('help-center'),
			).toBeFalsy();
		});

		it('returns false for unknown context', () => {
			setState({ showAIConsent: true, consentTerms: 'Terms' });
			const { shouldShowAIConsent } = useAIConsentStore.getState();
			expect(shouldShowAIConsent('unknown-context')).toBe(false);
		});
	});
});
