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

const setAssignments = (assignments) => {
	window.extLaunchData.activeTests = Object.fromEntries(
		Object.entries(assignments).map(([key, variant]) => [key, { variant }]),
	);
};

beforeEach(() => {
	window.extLaunchData = { urlParams: {}, activeTests: {} };
	mockLaunchStore.urlParams = {};
});

afterEach(() => {
	delete window.extLaunchData;
	delete window.extSharedData;
	mockLaunchStore.urlParams = {};
});

describe('DescriptionGathering — AutoLaunch.ShowTitle', () => {
	test('renders no title input for variant A', () => {
		setAssignments({ 'AutoLaunch.ShowTitle': 'A' });
		render(<DescriptionGathering />);
		expect(titleInput()).not.toBeInTheDocument();
	});

	test('renders no title input when no assignment is present', () => {
		render(<DescriptionGathering />);
		expect(titleInput()).not.toBeInTheDocument();
	});

	test('gates submit on the description for variant A', async () => {
		const user = userEvent.setup();
		render(<DescriptionGathering />);
		expect(submitButton()).toBeDisabled();
		await user.type(screen.getByRole('textbox'), 'a description');
		expect(submitButton()).toBeEnabled();
	});

	test('renders the site-title input and both field labels for variant B', () => {
		setAssignments({ 'AutoLaunch.ShowTitle': 'B' });
		render(<DescriptionGathering />);
		expect(titleInput()).toBeInTheDocument();
		expect(screen.getByText('Website title (required)')).toBeInTheDocument();
		expect(screen.getByText('Describe your website')).toBeInTheDocument();
	});

	test('gates submit on the title, ignoring an empty description, for variant B', async () => {
		const user = userEvent.setup();
		setAssignments({ 'AutoLaunch.ShowTitle': 'B' });
		render(<DescriptionGathering />);
		expect(submitButton()).toBeDisabled();
		await user.type(titleInput(), 'My Bakery');
		expect(submitButton()).toBeEnabled();
	});

	test('pre-fills the title with the decoded blogname', () => {
		setAssignments({ 'AutoLaunch.ShowTitle': 'B' });
		window.extSharedData = { siteTitle: 'Joe&#039;s Diner' };
		render(<DescriptionGathering />);
		expect(titleInput()).toHaveValue("Joe's Diner");
	});

	test('leaves the title blank when the blogname is a URL', () => {
		setAssignments({ 'AutoLaunch.ShowTitle': 'B' });
		window.extSharedData = { siteTitle: 'https://example.com' };
		render(<DescriptionGathering />);
		expect(titleInput()).toHaveValue('');
	});

	test('lets a ?title= param override the blogname prefill', () => {
		setAssignments({ 'AutoLaunch.ShowTitle': 'B' });
		window.extSharedData = { siteTitle: 'Sweet Spot Bakery' };
		mockLaunchStore.urlParams = { title: 'From URL Param' };
		render(<DescriptionGathering />);
		expect(titleInput()).toHaveValue('From URL Param');
	});

	test('autofocuses the description when the title field is hidden (variant A)', () => {
		setAssignments({ 'AutoLaunch.ShowTitle': 'A' });
		render(<DescriptionGathering />);
		expect(
			screen.getByPlaceholderText(/A personal photography portfolio/i),
		).toHaveFocus();
	});

	test('autofocuses the title field, not the description, when it is shown (variant B)', () => {
		setAssignments({ 'AutoLaunch.ShowTitle': 'B' });
		render(<DescriptionGathering />);
		expect(titleInput()).toHaveFocus();
		expect(
			screen.getByPlaceholderText(/A personal photography portfolio/i),
		).not.toHaveFocus();
	});
});

describe('DescriptionGathering — AutoLaunch.SubmitOutside', () => {
	test('keeps the submit button inside the input box for variant A', () => {
		render(<DescriptionGathering />);
		expect(descriptionBox()).toContainElement(submitButton());
	});

	test('renders the submit button below the input box for variant B', () => {
		setAssignments({ 'AutoLaunch.SubmitOutside': 'B' });
		render(<DescriptionGathering />);
		expect(descriptionBox()).not.toContainElement(submitButton());
	});
});

describe('DescriptionGathering — AutoLaunch.SubmitCreateWebsite', () => {
	test('labels the submit button "Next" for variant A', () => {
		render(<DescriptionGathering />);
		expect(submitButton()).toHaveTextContent('Next');
	});

	test('labels the submit button "Create website" for variant B', () => {
		setAssignments({ 'AutoLaunch.SubmitCreateWebsite': 'B' });
		render(<DescriptionGathering />);
		expect(submitButton()).toHaveTextContent('Create website');
	});
});

describe('DescriptionGathering — AutoLaunch.HideEnhanceAI', () => {
	test('shows the Enhance with AI button for variant A', () => {
		render(<DescriptionGathering />);
		expect(
			screen.getByRole('button', { name: /Enhance with AI/i }),
		).toBeInTheDocument();
	});

	test('hides the Enhance with AI button for variant B', () => {
		setAssignments({ 'AutoLaunch.HideEnhanceAI': 'B' });
		render(<DescriptionGathering />);
		expect(
			screen.queryByRole('button', { name: /Enhance with AI/i }),
		).not.toBeInTheDocument();
	});
});

describe('DescriptionGathering — AutoLaunch.DescriptionPlaceholderLaw', () => {
	test('uses the photography placeholder for variant A', () => {
		render(<DescriptionGathering />);
		expect(
			screen.getByPlaceholderText(/A personal photography portfolio/i),
		).toBeInTheDocument();
	});

	test('uses the law-firm placeholder for variant B', () => {
		setAssignments({ 'AutoLaunch.DescriptionPlaceholderLaw': 'B' });
		render(<DescriptionGathering />);
		expect(
			screen.getByPlaceholderText(/A boutique law firm/i),
		).toBeInTheDocument();
	});
});
