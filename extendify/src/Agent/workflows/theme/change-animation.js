import { SelectAnimation } from '@agent/workflows/theme/components/SelectAnimation';
import { __ } from '@wordpress/i18n';

const { abilities } = window.extAgentData;

export default {
	available: () => abilities?.canEditSettings && window.ExtendableAnimations,
	id: 'change-animation',
	whenFinished: { component: SelectAnimation },
	example: {
		// translators: "site animation" refers to the animation style for the current site.
		text: __('Change Site Animation', 'extendify-local'),
		agentResponse: {
			// translators: This message show above a UI where the user can select a different animation for their site.
			reply: __(
				'Below you can select a different animation for your site.',
				'extendify-local',
			),
			whenFinishedTool: {
				id: 'update-animation',
				labels: {
					confirm: __('Updated the site animation', 'extendify-local'),
					cancel: __('Canceled the site animation update', 'extendify-local'),
				},
			},
		},
	},
};
