import { __ } from '@wordpress/i18n';

export default {
	slug: 'setup-tec',
	title: __('Set up events', 'extendify-local'),
	description: __(
		'Start adding events to your site by configuring The Events Calendar plugin.',
		'extendify-local',
	),
	link: 'edit.php?page=tec-events-settings&post_type=tribe_events&welcome-message-the-events-calendar=1',
	buttonLabels: {
		notCompleted: __('Set up', 'extendify-local'),
		completed: __('Revisit', 'extendify-local'),
	},
	type: 'internalLink',
	dependencies: { goals: [], plugins: ['the-events-calendar'] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage:
		'https://assets.extendify.com/assist-tasks/calendar-events.webp',
};
