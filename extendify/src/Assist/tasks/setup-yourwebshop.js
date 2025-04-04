import { __ } from '@wordpress/i18n';

const { themeSlug } = window.extSharedData;
const { launchCompleted } = window.extAssistData;

export default {
	slug: 'setup-yourwebshop',
	title: __('Set up YourWebshop', 'extendify-local'),
	description: __(
		'Set up the YourWebshop plugin and start selling on your website right away.',
		'extendify-local',
	),
	link: '?page=ec-store',
	buttonLabels: {
		notCompleted: __('Set up', 'extendify-local'),
		completed: __('Revisit', 'extendify-local'),
	},
	type: 'internalLink',
	dependencies: {
		goals: [],
		plugins: ['YourWebshop-updater', 'ecwid-shopping-cart'],
	},
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		// They need either extendable or launch completed
		if (themeSlug !== 'extendable' && !launchCompleted) return false;

		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage:
		'https://images.extendify-cdn.com/assist-tasks/e-commerce-2.webp',
};
