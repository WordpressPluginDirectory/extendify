import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import apiFetch from '@wordpress/api-fetch';
import { Spinner } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { chevronRight, Icon } from '@wordpress/icons';

export const RestartLaunchModal = ({ pages }) => {
	const { resetSiteInformation } = window.extLaunchData;
	const { navigationIds, templatePartsIds, pageWithTitleTemplateId } =
		resetSiteInformation || {};
	const globalStylesPostID = window.extSharedData.globalStylesPostID;

	const { reset: resetLaunchData } = useLaunchDataStore();
	const [processing, setProcessing] = useState(false);
	const handleExit = () => {
		window.location.href = `${window.extSharedData.adminUrl}admin.php?page=extendify-assist`;
	};

	const handleOk = async () => {
		setProcessing(true);
		resetLaunchData({ exclude: ['descriptionBackup'] });
		// remove any workflow info
		localStorage.removeItem(
			`extendify-agent-workflows-${window.extSharedData.siteId}`,
		);
		for (const pageId of pages) {
			try {
				await apiFetch({
					path: `/wp/v2/pages/${pageId}`,
					method: 'DELETE',
				});
			} catch (responseError) {
				console.warn(
					`delete pages failed to delete a page (id: ${pageId}) with the following error`,
					responseError,
				);
			}
		}
		// They could be posts
		for (const pageId of pages) {
			try {
				await apiFetch({
					path: `/wp/v2/posts/${pageId}`,
					method: 'DELETE',
				});
			} catch (responseError) {
				console.warn(
					`delete posts failed to delete a page (id: ${pageId}) with the following error`,
					responseError,
				);
			}
		}
		// delete the wp_navigation posts created by Launch
		for (const navigationId of navigationIds || []) {
			try {
				await apiFetch({
					path: `/wp/v2/navigation/${navigationId}`,
					method: 'DELETE',
				});
			} catch (responseError) {
				console.warn(
					`delete navigation failed to delete a navigation (id: ${navigationId}) with the following error`,
					responseError,
				);
			}
		}

		for (const template of templatePartsIds || []) {
			try {
				await apiFetch({
					path: `/wp/v2/template-parts/${template}?force=true`,
					method: 'DELETE',
				});
			} catch (responseError) {
				console.warn(
					`delete template failed to delete template (id: ${template}) with the following error`,
					responseError,
				);
			}
		}

		try {
			if (pageWithTitleTemplateId) {
				await apiFetch({
					path: `/wp/v2/templates/${pageWithTitleTemplateId}?force=true`,
					method: 'DELETE',
				});
			}
		} catch (responseError) {
			console.warn('Failed to delete page-with-title template:', responseError);
		}

		// Reset global styles
		try {
			if (globalStylesPostID) {
				await apiFetch({
					path: `/wp/v2/global-styles/${globalStylesPostID}`,
					method: 'POST',
					body: JSON.stringify({ settings: {}, styles: {} }),
				});
			}
		} catch (styleResetError) {
			console.warn(
				'Failed to reset global styles with the following error:',
				styleResetError,
			);
		}
		window.location.reload();
	};

	return (
		<div className="flex w-full flex-col gap-6 p-6">
			<h2 className="text-2xl leading-8 text-left text-gray-900 font-medium py-0 m-0">
				{__('Start Over?', 'extendify-local')}
			</h2>

			<div className="flex flex-col gap-3">
				<p className="text-base leading-6 text-left text-gray-900 m-0">
					{__(
						'It looks like you have been here before. We need to clean up some things before we can continue.',
						'extendify-local',
					)}
				</p>
				<p className="text-base leading-6 text-left text-gray-900 font-medium m-0">
					{sprintf(
						// translators: %3$s is the number of old pages
						__('%s pages/posts will be deleted.', 'extendify-local'),
						pages.length,
					)}
				</p>
			</div>

			<div className="flex justify-between items-center mt-2">
				<Nav
					handleOk={handleOk}
					handleExit={handleExit}
					processing={processing}
				/>
			</div>
		</div>
	);
};

const Nav = ({ handleOk, handleExit, processing }) => {
	return (
		<>
			<button
				type="button"
				onClick={handleExit}
				disabled={processing}
				className="inline-flex items-center gap-2 rounded-full ring-1 ring-gray-800 px-3 py-2.5 text-sm leading-5 font-normal text-gray-800 transition-colors hover:bg-gray-600/5 disabled:opacity-40"
			>
				<span className="px-1">{__('Exit', 'extendify-local')}</span>
			</button>
			{processing ? (
				<button
					type="button"
					disabled
					className="inline-flex items-center justify-center gap-2 rounded-full border-0 bg-design-main px-3 py-2 text-sm leading-5 font-normal text-design-text disabled:opacity-40"
				>
					<Spinner className="m-0" />
					<span className="px-1">{__('Processing...', 'extendify-local')}</span>
				</button>
			) : (
				<button
					type="button"
					onClick={handleOk}
					className="inline-flex items-center justify-center rounded-full border-0 bg-design-main px-3 py-2 text-sm leading-5 font-normal text-design-text group hover:opacity-90 transition-opacity"
				>
					<span className="px-1">
						{__('Delete and start over', 'extendify-local')}
					</span>
					<Icon fill="currentColor" icon={chevronRight} size={24} />
				</button>
			)}
		</>
	);
};
