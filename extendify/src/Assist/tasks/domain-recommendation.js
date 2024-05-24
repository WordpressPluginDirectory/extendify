import { __ } from '@wordpress/i18n';

export default {
	slug: 'domain-recommendation',
	title: __('Choose your domain', 'extendify-local'),
	innerTitle: __('Claim your domain', 'extendify-local'),
	description: __('Claim the perfect domain for your site.', 'extendify-local'),
	buttonLabels: {
		completed: __('Register this domain', 'extendify-local'),
		notCompleted: __('Register this domain', 'extendify-local'),
	},
	type: 'domain-task',
	dependencies: { goals: [], plugins: [] },
	show: ({ showDomainTask }) => showDomainTask,
	backgroundImage:
		'https://assets.extendify.com/assist-tasks/domains-recommendations.webp',
};
