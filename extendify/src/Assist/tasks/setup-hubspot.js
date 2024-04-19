import { __ } from '@wordpress/i18n';

export default {
	slug: 'setup-hubspot',
	title: __('Set up HubSpot', 'extendify-local'),
	description: __(
		'Start collecting emails and marketing to your customers',
		'extendify-local',
	),
	link: 'admin.php?page=leadin',
	buttonLabels: {
		notCompleted: __('Set up', 'extendify-local'),
		completed: __('Revisit', 'extendify-local'),
	},
	type: 'internalLink',
	dependencies: { goals: [], plugins: ['leadin'] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage: `${window.extSharedData.assetPath}/hubspot.png`,
};
