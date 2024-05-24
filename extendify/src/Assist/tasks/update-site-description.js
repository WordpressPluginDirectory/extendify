import { __ } from '@wordpress/i18n';

export default {
	slug: 'site-description',
	title: __('Add a site description', 'extendify-local'),
	description: __(
		'In a few words, explain what your site is about.',
		'extendify-local',
	),
	buttonLabels: {
		completed: __('Change', 'extendify-local'),
		notCompleted: __('Add', 'extendify-local'),
	},
	type: 'modal',
	dependencies: { goals: [], plugins: [] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage: 'https://assets.extendify.com/assist-tasks/upload-logo.webp',
};
