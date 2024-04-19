import { __ } from '@wordpress/i18n';

export default {
	slug: 'logo',
	title: __('Upload a logo', 'extendify-local'),
	description: __(
		'Ensure your website is on-brand by adding your logo.',
		'extendify-local',
	),
	buttonLabels: {
		completed: __('Replace', 'extendify-local'),
		notCompleted: __('Upload', 'extendify-local'),
	},
	type: 'modal',
	dependencies: { goals: [], plugins: [] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage: `${window.extSharedData.assetPath}/upload-logo.png`,
};
