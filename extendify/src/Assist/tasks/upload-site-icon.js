import { __ } from '@wordpress/i18n';

export default {
	slug: 'site-icon',
	title: __('Upload a site icon', 'extendify-local'),
	description: __(
		'Ensure your website is on-brand by adding your site icon.',
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
	backgroundImage: `${window.extSharedData.assetPath}/edit-homepage.png`,
};
