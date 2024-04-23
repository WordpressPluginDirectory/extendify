import { __ } from '@wordpress/i18n';
import {
	Icon,
	plugins,
	styles,
	post,
	page,
	header,
	footer,
	reusableBlock,
	navigation,
} from '@wordpress/icons';
import classNames from 'classnames';

const { themeSlug, devbuild, adminUrl, isBlockTheme } = window.extSharedData;
const { hasCustomizer, editSiteNavigationMenuLink } = window.extAssistData;

const showRestartLaunch =
	devbuild || window.extAssistData.canSeeRestartLaunch || false;

export const QuickLinks = ({ className }) => {
	const quickLinks = [
		{
			title: __('Add new page', 'extendify-local'),
			link: `${adminUrl}post-new.php?post_type=page`,
			slug: 'add-new-page',
			icon: page,
			show: true,
		},
		{
			title: __('Add new post', 'extendify-local'),
			link: `${adminUrl}post-new.php`,
			slug: 'add-new-post',
			icon: post,
			show: true,
		},
		{
			title: __('Explore plugins', 'extendify-local'),
			link: `${adminUrl}plugin-install.php`,
			slug: 'explore-plugins',
			icon: plugins,
			show: true,
		},
		{
			title: __('Site style', 'extendify-local'),
			link: `${adminUrl}site-editor.php?path=%2Fwp_global_styles`,
			slug: 'site-style',
			icon: styles,
			show: isBlockTheme,
		},
		{
			title: __('Site style', 'extendify-local'),
			link: `${adminUrl}customize.php?return=%2Fwp%2Fwp-admin%2Fadmin.php%3Fpage%3Dextendify-assist`,
			slug: 'site-style-classic',
			icon: styles,
			show: hasCustomizer && !isBlockTheme,
		},
		{
			title: __('Edit header', 'extendify-local'),
			link: `${adminUrl}site-editor.php?postId=extendable%2F%2Fheader&postType=wp_template_part`,
			slug: 'edit-header',
			icon: header,
			show: themeSlug === 'extendable',
		},
		{
			title: __('Edit footer', 'extendify-local'),
			link: `${adminUrl}site-editor.php?postId=extendable%2F%2Ffooter&postType=wp_template_part&canvas=edit`,
			slug: 'edit-footer',
			icon: footer,
			show: themeSlug === 'extendable',
		},
		{
			title: __('Edit Site Navigation', 'extendify-local'),
			link: editSiteNavigationMenuLink,
			slug: 'edit-site-navigation',
			icon: navigation,
			show: true,
		},
		{
			// translators: "Reset site" refers to the action of resetting the user's WordPress site to a fresh state.
			title: __('Reset site', 'extendify-local'),
			link: `${adminUrl}admin.php?page=extendify-launch`,
			slug: 'reset-site',
			icon: reusableBlock,
			show: showRestartLaunch,
		},
	];

	return (
		<>
			<div
				data-test="assist-quick-links-module"
				className={classNames(
					className,
					'w-full p-5 lg:p-8 border border-gray-300 text-base bg-white rounded h-full',
				)}>
				<h2 className="font-semibold text-lg mt-0 mb-4">
					{__('Quick Links', 'extendify-local')}
				</h2>
				<div className="grid md:grid-rows-2 gap-x-6 md:grid-flow-col place-items-start">
					{quickLinks
						.filter((item) => item.show)
						.map((item) => (
							<a
								key={item.slug}
								href={item.link}
								title={item.title}
								data-test={`assist-quick-links-module-${item.slug}`}
								className="text-sm py-1.5 flex justify-center items-center hover:text-design-main hover:underline hover:underline-offset-2 no-underline text-gray-800">
								<Icon icon={item.icon} className="fill-current mr-2" />
								<span className="mr-1">{item.title}</span>
							</a>
						))}
				</div>
			</div>
		</>
	);
};
