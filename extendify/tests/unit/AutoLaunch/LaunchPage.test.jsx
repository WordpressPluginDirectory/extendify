import { LaunchPage } from '@auto-launch/LaunchPage';
import { render, screen } from '@testing-library/react';

jest.mock('@auto-launch/components/Launch', () => ({
	Launch: () => <div data-testid="launch" />,
}));
jest.mock('@auto-launch/components/Logo', () => ({ Logo: () => null }));
jest.mock('@auto-launch/components/MovingGradients', () => ({
	MovingGradient: () => null,
}));
jest.mock('@auto-launch/components/NeedsTheme', () => ({
	NeedsTheme: () => null,
}));
jest.mock('@auto-launch/components/RestartLaunchModal', () => ({
	RestartLaunchModal: () => null,
}));
jest.mock('@auto-launch/components/ViewportPulse', () => ({
	ViewportPulse: () => null,
}));
jest.mock('@auto-launch/functions/wp', () => ({ updateOption: jest.fn() }));
jest.mock('@auto-launch/functions/setup', () => ({
	preLaunchFunctions: jest.fn(),
}));
jest.mock('@auto-launch/state/launch-data', () => ({
	useLaunchDataStore: () => ({
		title: null,
		descriptionRaw: null,
		go: false,
		urlParams: {},
		designBuild: false,
		pulse: false,
	}),
}));
jest.mock('@wordpress/block-library', () => ({
	registerCoreBlocks: jest.fn(),
}));
jest.mock('@wordpress/blocks', () => ({ getBlockTypes: () => [{}] }));
jest.mock('@wordpress/data', () => ({
	useSelect: () => ({ textdomain: 'extendable' }),
}));
jest.mock('framer-motion', () => ({
	AnimatePresence: ({ children }) => <>{children}</>,
	motion: new Proxy(
		{},
		{ get: () => (props) => <div {...props}>{props.children}</div> },
	),
}));
jest.mock('@auto-launch/functions/insights', () => ({ checkIn: jest.fn() }));

beforeAll(() => {
	window.extLaunchData = {
		resetSiteInformation: { pagesIds: [] },
		urlParams: {},
		hideAutoLaunchExitLink: false,
	};
});

afterAll(() => {
	delete window.extLaunchData;
});

beforeEach(() => {
	window.extSharedData = {
		adminUrl: 'https://example.test/wp-admin/',
	};
});

describe('AutoLaunchPage — hideAutoLaunchExitLink flag', () => {
	test('shows the WP Admin Dashboard exit link when the flag is false', () => {
		render(<LaunchPage />);
		expect(
			screen.getByRole('link', { name: /WP Admin Dashboard/i }),
		).toBeInTheDocument();
	});

	test('hides the WP Admin Dashboard exit link when the flag is true', () => {
		window.extLaunchData.hideAutoLaunchExitLink = true;
		render(<LaunchPage />);
		expect(
			screen.queryByRole('link', { name: /WP Admin Dashboard/i }),
		).not.toBeInTheDocument();
	});
});

describe('AutoLaunchPage — AutoLaunch.WebsiteTitle A/B test', () => {
	test('shows the alternate heading and subtitle for variant B', () => {
		window.extLaunchData.activeTests = { 'AutoLaunch.WebsiteTitle': 'B' };
		render(<LaunchPage />);
		expect(screen.getByText(/Tell Us About Your Website/i)).toBeInTheDocument();
		expect(
			screen.getByText(/Share your vision, and we'll craft a website/i),
		).toBeInTheDocument();
	});

	test('shows the current heading and no subtitle for variant A', () => {
		window.extLaunchData.activeTests = { 'AutoLaunch.WebsiteTitle': 'A' };
		render(<LaunchPage />);
		expect(
			screen.getByText(/Describe the website you want to build/i),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/Share your vision, and we'll craft a website/i),
		).not.toBeInTheDocument();
	});

	test('shows the current heading when no assignment is present', () => {
		window.extLaunchData.activeTests = {};
		render(<LaunchPage />);
		expect(
			screen.getByText(/Describe the website you want to build/i),
		).toBeInTheDocument();
	});
});
