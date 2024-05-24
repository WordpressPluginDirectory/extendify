import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useTasksStore } from '@assist/state/tasks';

const launchSteps = {
	'site-type': {
		step: __('Site Industry', 'extendify-local'),
		title: __("Let's Start Building Your Website", 'extendify-local'),
		description: __(
			'Create a super-fast, beautiful, and fully customized site in minutes with our Site Launcher.',
			'extendify-local',
		),
		buttonText: __('Select Site Industry', 'extendify-local'),
	},
	'site-title': {
		step: __('Site Title', 'extendify-local'),
		title: __('Continue Building Your Website', 'extendify-local'),
		description: __(
			'Create a super-fast, beautiful, and fully customized site in minutes with our Site Launcher.',
			'extendify-local',
		),
		buttonText: __('Set Site Title', 'extendify-local'),
	},
	goals: {
		step: __('Goals', 'extendify-local'),
		title: __('Continue Building Your Website', 'extendify-local'),
		description: __(
			'Create a super-fast, beautiful, and fully customized site in minutes with our Site Launcher.',
			'extendify-local',
		),
		buttonText: __('Select Site Goals', 'extendify-local'),
	},
	layout: {
		step: __('Design', 'extendify-local'),
		title: __('Continue Building Your Website', 'extendify-local'),
		description: __(
			'Create a super-fast, beautiful, and fully customized site in minutes with our Site Launcher.',
			'extendify-local',
		),
		buttonText: __('Select Site Design', 'extendify-local'),
	},
	pages: {
		step: __('Pages', 'extendify-local'),
		title: __('Continue Building Your Website', 'extendify-local'),
		description: __(
			'Create a super-fast, beautiful, and fully customized site in minutes with our Site Launcher.',
			'extendify-local',
		),
		buttonText: __('Select Site Pages', 'extendify-local'),
	},
};

const getCurrentLaunchStep = () => {
	const pageData = JSON.parse(
		localStorage.getItem(`extendify-pages-${window.extSharedData.siteId}`),
	) || { state: {} };
	const currentPageSlug = pageData?.state?.currentPageSlug;

	// If their last step doesn't exist in our options, just use step 1
	if (!Object.keys(launchSteps).includes(currentPageSlug)) {
		return 'site-type';
	}

	return currentPageSlug;
};

export const LaunchCard = ({ task }) => {
	const [currentStep, setCurrentStep] = useState();
	const { dismissTask } = useTasksStore();

	useEffect(() => {
		if (currentStep) return;
		setCurrentStep(getCurrentLaunchStep());
	}, [currentStep]);

	return (
		<div className="justify-center h-full text-base bg-design-main overflow-hidden">
			<div className="mx-11 my-16">
				<img
					alt="preview"
					className="object-cover w-full block"
					src={task.backgroundImage}
				/>
				<div className="w-full text-center">
					<h2 className="text-2xl mb-4 mt-8 text-white">
						{launchSteps[currentStep]?.title}
					</h2>
					<p className="my-4 text-base text-gray-50">
						{launchSteps[currentStep]?.description}
					</p>
					<div>
						<a
							href={`${window.extSharedData.adminUrl}admin.php?page=extendify-launch`}
							className="inline-block rounded mt-4 px-4 py-2.5 bg-white text-gray-900 border-none no-underline cursor-pointer">
							{launchSteps[currentStep]?.buttonText}
						</a>
						<button
							type="button"
							id="dismiss"
							onClick={() => {
								dismissTask('site-builder-launcher');
							}}
							className="text-design-text cursor-pointer text-center bg-transparent mx-3 text-sm py-2 px-2">
							{__('Dismiss', 'extendify-local')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
