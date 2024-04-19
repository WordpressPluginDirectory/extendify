import { __ } from '@wordpress/i18n';

export default {
	slug: 'setup-woocommerce-store',
	title: __('Set up WooCommerce store', 'extendify-local'),
	description: __(
		'This setup wizard help set up your store. It asks about your location, industry, and products to provide recommendations specific to your needs.',
		'extendify-local',
	),
	link: 'admin.php?page=wc-admin&path=%2Fsetup-wizard',
	buttonLabels: {
		notCompleted: __('Set up', 'extendify-local'),
		completed: __('Revisit', 'extendify-local'),
	},
	type: 'internalLink',
	dependencies: { goals: ['products', 'services'], plugins: ['woocommerce'] },
	show: ({ plugins, goals, activePlugins, userGoals }) => {
		if (!plugins.length && !goals.length) return true;

		return activePlugins
			.concat(userGoals)
			.some((item) => plugins.concat(goals).includes(item));
	},
	backgroundImage: `${window.extSharedData.assetPath}/woocommerce.png`,
};
