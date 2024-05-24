import { __ } from '@wordpress/i18n';

const { frontPage } = window.extSharedData || {};

export default {
	slug: 'edit-homepage',
	title: __('Edit your homepage', 'extendify-local'),
	description: __(
		'Edit homepage by replacing existing content.',
		'extendify-local',
	),
	buttonLabels: {
		completed: __('Edit now', 'extendify-local'),
		notCompleted: __('Edit now', 'extendify-local'),
	},
	link: 'post.php?post=$&action=edit',
	type: 'internalLink',
	dependencies: { goals: [], plugins: [] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!Number(frontPage)) return false;

		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage:
		'https://assets.extendify.com/assist-tasks/edit-homepage.webp',
};
