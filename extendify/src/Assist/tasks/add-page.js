import { __ } from '@wordpress/i18n';

export default {
	slug: 'add-pages',
	title: __('Add page', 'extendify-local'),
	description: __('Add a new page for your website.', 'extendify-local'),
	buttonLabels: {
		completed: __('Add new', 'extendify-local'),
		notCompleted: __('Add new', 'extendify-local'),
	},
	link: 'post-new.php?post_type=page',
	type: 'internalLink',
	dependencies: { goals: [], plugins: [] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage: `${window.extSharedData.assetPath}/add-page.png`,
};
