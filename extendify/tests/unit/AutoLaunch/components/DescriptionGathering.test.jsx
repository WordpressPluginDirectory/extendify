import { DescriptionGathering } from '@auto-launch/components/DescriptionGathering';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@auto-launch/hooks/useInstallRequiredPlugins', () => ({
	useInstallRequiredPlugins: jest.fn(),
}));
jest.mock('@auto-launch/functions/helpers', () => ({
	fetchWithTimeout: jest.fn(),
}));
jest.mock('@auto-launch/icons', () => ({ loaderThreeDots: null }));
const mockLaunchStore = {
	setData: jest.fn(),
	descriptionBackup: '',
	urlParams: {},
};
jest.mock('@auto-launch/state/launch-data', () => ({
	useLaunchDataStore: () => mockLaunchStore,
}));
jest.mock('@shared/state/ai-consent', () => ({
	useAIConsentStore: () => ({ consentTerms: '' }),
}));

const submitButton = () =>
	screen.getAllByRole('button').find((b) => b.type === 'submit');

const descriptionBox = () =>
	screen
		.getByPlaceholderText(/A personal photography portfolio/i)
		.closest('.rounded-3xl');

const titleInput = () =>
	screen.queryByPlaceholderText(/Enter your website name/i);

describe('DescriptionGathering — AutoLaunch.WebsiteTitle variant A', () => {
	beforeEach(() => {
		window.extLaunchData = { urlParams: {}, activeTests: {} };
	});

	afterEach(() => {
		delete window.extLaunchData;
	});

	test('renders no title input', () => {
		window.extLaunchData.activeTests = { 'AutoLaunch.WebsiteTitle': 'A' };
		render(<DescriptionGathering />);
		expect(titleInput()).not.toBeInTheDocument();
	});

	test('renders no title input when no assignment is present', () => {
		render(<DescriptionGathering />);
		expect(titleInput()).not.toBeInTheDocument();
	});

	test('keeps the submit button inside the input box', () => {
		render(<DescriptionGathering />);
		expect(descriptionBox()).toContainElement(submitButton());
	});

	test('gates submit on the description', async () => {
		const user = userEvent.setup();
		render(<DescriptionGathering />);
		expect(submitButton()).toBeDisabled();
		await user.type(screen.getByRole('textbox'), 'a description');
		expect(submitButton()).toBeEnabled();
	});
});

describe('DescriptionGathering — AutoLaunch.WebsiteTitle variant B', () => {
	beforeEach(() => {
		window.extLaunchData = {
			urlParams: {},
			activeTests: { 'AutoLaunch.WebsiteTitle': 'B' },
		};
		mockLaunchStore.urlParams = {};
	});

	afterEach(() => {
		delete window.extLaunchData;
		delete window.extSharedData;
		mockLaunchStore.urlParams = {};
	});

	test('renders the site-title input and both field labels', () => {
		render(<DescriptionGathering />);
		expect(titleInput()).toBeInTheDocument();
		expect(screen.getByText('Website title (required)')).toBeInTheDocument();
		expect(screen.getByText('Describe your website')).toBeInTheDocument();
	});

	test('renders the submit button below the input box', () => {
		render(<DescriptionGathering />);
		expect(descriptionBox()).not.toContainElement(submitButton());
	});

	test('gates submit on the title, ignoring an empty description', async () => {
		const user = userEvent.setup();
		render(<DescriptionGathering />);
		expect(submitButton()).toBeDisabled();
		await user.type(titleInput(), 'My Bakery');
		expect(submitButton()).toBeEnabled();
	});

	test('pre-fills the title with the decoded blogname', () => {
		window.extSharedData = { siteTitle: 'Joe&#039;s Diner' };
		render(<DescriptionGathering />);
		expect(titleInput()).toHaveValue("Joe's Diner");
	});

	test('leaves the title blank when the blogname is a URL', () => {
		window.extSharedData = { siteTitle: 'https://example.com' };
		render(<DescriptionGathering />);
		expect(titleInput()).toHaveValue('');
	});

	test('lets a ?title= param override the blogname prefill', () => {
		window.extSharedData = { siteTitle: 'Sweet Spot Bakery' };
		mockLaunchStore.urlParams = { title: 'From URL Param' };
		render(<DescriptionGathering />);
		expect(titleInput()).toHaveValue('From URL Param');
	});
});
