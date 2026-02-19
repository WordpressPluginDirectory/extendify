import { Redirect } from '@agent/workflows/theme/components/Redirect';
import { SelectSiteVibes } from '@agent/workflows/theme/components/SelectSiteVibes';
import { __ } from '@wordpress/i18n';

const { context, abilities } = window.extAgentData;

export default {
	available: () =>
		abilities?.canEditThemes &&
		context?.hasThemeVariations &&
		context?.isUsingVibes,
	needsRedirect: () => !Number(context?.postId || 0),
	redirectComponent: () =>
		Redirect(
			// translators: "site style" refers to the structural aesthetic style for the site.
			__(
				'Hey there! It looks like you are trying to change your site style, but you are not on a page where we can do that.',
				'extendify-local',
			),
		),
	id: 'change-site-vibes',
	whenFinished: { component: SelectSiteVibes },
};
