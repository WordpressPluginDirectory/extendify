import { DescriptionGathering } from '@auto-launch/components/DescriptionGathering';
import { render } from '@testing-library/react';

jest.mock('@auto-launch/hooks/useInstallRequiredPlugins', () => ({
	useInstallRequiredPlugins: () => {},
}));
jest.mock('@auto-launch/state/launch-data', () => ({
	useLaunchDataStore: () => ({
		setData: jest.fn(),
		descriptionBackup: '',
		urlParams: {},
	}),
}));
jest.mock('@shared/state/ai-consent', () => ({
	useAIConsentStore: () => ({ consentTerms: '' }),
}));

const setVariant = (value) => {
	window.extLaunchData = { activeTests: { 'AutoLaunch.WebsiteTitle': value } };
};

afterEach(() => {
	window.extLaunchData = undefined;
});

const titleField = (c) => c.querySelector('#extendify-launch-site-title');
const descriptionField = (c) =>
	c.querySelector('#extendify-launch-chat-textarea');

describe('DescriptionGathering autofocus', () => {
	it('focuses the description in variant A (no title field)', () => {
		setVariant('A');
		const { container } = render(<DescriptionGathering />);
		expect(titleField(container)).not.toBeInTheDocument();
		expect(descriptionField(container)).toHaveFocus();
	});

	it('focuses the title field in variant B', () => {
		setVariant('B');
		const { container } = render(<DescriptionGathering />);
		expect(titleField(container)).toHaveFocus();
		expect(descriptionField(container)).not.toHaveFocus();
	});
});
