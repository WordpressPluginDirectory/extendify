import { __ } from '@wordpress/i18n';

export default {
	id: 'site-assistant-tour',
	title: __('Site Assistant', 'extendify-local'),
	settings: {
		allowOverflow: false,
		startFrom: [
			`${window.extSharedData.adminUrl}admin.php?page=extendify-assist#dashboard`,
		],
	},
	onStart: () => window.dispatchEvent(new CustomEvent('extendify-hc:minimize')),
	steps: [
		{
			title: __('Tasks', 'extendify-local'),
			text: __(
				"Now that you've created your starter site, make it your own with these follow up tasks.",
				'extendify-local',
			),
			showOnlyIf: () => document.getElementById('assist-tasks-module'),
			attachTo: {
				element: '#assist-tasks-module',
				offset: {
					marginTop: window.innerWidth <= 1151 ? -15 : 2,
					marginLeft: window.innerWidth <= 1151 ? -25 : 15,
				},
				position: {
					x: 'top',
					y: 'bottom',
				},
				hook: 'top left',
			},
			events: {
				onAttach: () => {
					document.querySelector('#assist-tasks-module')?.scrollIntoView();
				},
			},
		},
		{
			title: __('Quick Links', 'extendify-local'),
			text: __(
				'Easily access some of the most common items in WordPress with these quick links.',
				'extendify-local',
			),
			attachTo: {
				element: '#assist-quick-links-module',
				offset: {
					marginTop: window.innerWidth <= 1151 ? -15 : 0,
					marginLeft: window.innerWidth <= 1151 ? -25 : -15,
				},
				position: {
					x: 'right',
					y: 'top',
				},
				hook: 'top left',
			},
			events: {
				onAttach: () => {
					document
						.querySelector('#assist-quick-links-module')
						?.scrollIntoView();
				},
			},
		},
		{
			title: __('Website Tools & Plugins', 'extendify-local'),
			text: __(
				'See our personalized recommendations for you that will help you accomplish your goals.',
				'extendify-local',
			),
			showOnlyIf: () =>
				document.querySelector('#assist-recommendations-module'),
			attachTo: {
				element: '#assist-recommendations-module',
				offset: {
					marginTop: window.innerWidth <= 1151 ? -15 : 2,
					marginLeft: window.innerWidth <= 1151 ? -25 : 15,
				},
				position: {
					x: 'right',
					y: 'top',
				},
				hook: 'top left',
			},
			events: {
				onAttach: () => {
					document
						.querySelector('#assist-recommendations-module')
						?.scrollIntoView();
				},
			},
		},
		{
			title: __('Help Center', 'extendify-local'),
			text: __(
				'You can always access the help center by clicking this button.',
				'extendify-local',
			),
			showOnlyIf: () => document.querySelector('#wp-admin-bar-help-center-btn'),
			attachTo: {
				element: '#wp-admin-bar-help-center-btn',
				offset: {
					marginTop: 45,
					marginLeft: -5,
				},
				position: {
					x: 'right',
					y: 'top',
				},
				hook: 'top left',
			},
			events: {
				onAttach: () => {
					document
						.querySelector('#wp-admin-bar-help-center-btn')
						?.scrollIntoView();
				},
			},
		},
		{
			title: __('Visit your site', 'extendify-local'),
			text: __(
				'You can always visit your site by clicking this button.',
				'extendify-local',
			),
			attachTo: {
				element: '#assist-menu-bar',
				offset: {
					marginTop: 20,
					marginLeft: -5,
				},
				position: {
					x: 'left',
					y: 'bottom',
				},
				hook: 'top left',
				boxPadding: {
					top: 5,
					bottom: 5,
					left: 5,
					right: 5,
				},
			},
			events: {
				onAttach: () => {
					document.querySelector('#assist-menu-bar')?.scrollIntoView();
				},
			},
		},
		{
			title: __('Site Assistant', 'extendify-local'),
			text: __(
				'Come back to the Site Assistant any time by clicking the menu item.',
				'extendify-local',
			),
			attachTo: {
				element: '#toplevel_page_extendify-admin-page',
				offset: {
					marginTop: 0,
					marginLeft: 15,
				},
				position: {
					x: 'right',
					y: 'top',
				},
				hook: 'top left',
			},
			events: {
				onAttach: () => {
					if (document.body.classList.contains('folded')) {
						document.body.classList.remove('folded');
						document.body.classList.add('temp-open');
					}
					document
						.querySelector('#extendify-assist-landing-page')
						.scrollIntoView({ block: 'start' });
				},
				onDetach: () => {
					if (document.body.classList.contains('temp-open')) {
						document.body.classList.remove('temp-open');
						document.body.classList.add('folded');
					}
				},
			},
		},
	],
};
