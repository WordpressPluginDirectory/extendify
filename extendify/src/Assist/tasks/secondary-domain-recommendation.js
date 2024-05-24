import { __ } from '@wordpress/i18n';

export default {
	slug: 'secondary-domain-recommendation',
	title: __('Add an additional domain', 'extendify-local'),
	innerTitle: __('Add an additional domain', 'extendify-local'),
	description: __('Get another domain for your site.', 'extendify-local'),
	buttonLabels: {
		completed: __('Register this domain', 'extendify-local'),
		notCompleted: __('Register this domain', 'extendify-local'),
	},
	type: 'secondary-domain-task',
	dependencies: { goals: [], plugins: [] },
	show: ({ showSecondaryDomainTask }) => showSecondaryDomainTask,
	backgroundImage:
		'https://assets.extendify.com/assist-tasks/domains-recommendations.webp',
};
