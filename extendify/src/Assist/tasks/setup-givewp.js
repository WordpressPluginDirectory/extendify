import { __ } from '@wordpress/i18n';

export default {
	slug: 'setup-givewp',
	title: __('Set up donations', 'extendify-local'),
	description: __(
		'Set up the GiveWP plugin to enable donations on your site.',
		'extendify-local',
	),
	link: '?page=give-onboarding-wizard',
	buttonLabels: {
		notCompleted: __('Set up', 'extendify-local'),
		completed: __('Revisit', 'extendify-local'),
	},
	type: 'internalLink',
	dependencies: { goals: [], plugins: ['give'] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage: 'https://assets.extendify.com/assist-tasks/givewp.webp',
};
