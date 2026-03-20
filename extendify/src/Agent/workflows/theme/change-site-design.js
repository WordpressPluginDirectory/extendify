import { __ } from '@wordpress/i18n';
import { layout } from '@wordpress/icons';
import { SelectSiteDesign } from './components/SelectSiteDesign';

const { context, abilities } = window.extAgentData;

const workflow = {
	available: () =>
		abilities?.canEditThemes &&
		!context?.adminPage &&
		context?.postId &&
		!context?.isBlogPage &&
		context?.isBlockTheme,
	id: 'change-site-design',
	whenFinished: {
		component: SelectSiteDesign,
	},
	example: {
		text: __('Change website design', 'extendify-local'),
		agentResponse: {
			// translators: This message show above a UI where the user can select a different site design.
			reply: __(
				'Below you can select a different design for your website.',
				'extendify-local',
			),
			whenFinishedTool: {
				id: 'change-site-design',
				labels: {
					confirm: __('Updated the website design', 'extendify-local'),
					cancel: __('Canceled the website design update', 'extendify-local'),
				},
			},
		},
	},
	icon: layout,
};

export default workflow;
