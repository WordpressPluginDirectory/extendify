import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import apiFetch from '@wordpress/api-fetch';
import { Button, Spinner } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

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
		<div className="flex w-full flex-col max-w-5xl p-6 lg:p-10">
			<h2 className="text-lg text-center text-gray-900 font-semibold px-4 py-0 m-0 mb-4">
				{__('Start Over?', 'extendify-local')}
			</h2>
			<div className="relative mx-auto w-full max-w-xl text-gray-900">
				<p className="m-0 mb-4 text-base">
					{__(
						'It looks like you have been here before. We need to clean up some things before we can continue.',
						'extendify-local',
					)}
				</p>
				<p>
					<strong>
						{sprintf(
							// translators: %3$s is the number of old pages
							__('%s pages/posts will be deleted.', 'extendify-local'),
							pages.length,
						)}
					</strong>
				</p>
			</div>
			<div className="flex justify-end gap-2">
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
	if (processing) {
		return (
			<Button
				variant="primary"
				onClick={handleOk}
				disabled={processing}
				className="flex gap-2 items-center"
			>
				<Spinner className="m-0" />
				<div>{__('Processing...', 'extendify-local')}</div>
			</Button>
		);
	}
	return (
		<>
			<Button
				variant="secondary"
				size=""
				onClick={handleExit}
				disabled={processing}
			>
				{__('Exit', 'extendify-local')}
			</Button>
			<Button variant="primary" onClick={handleOk} disabled={processing}>
				{__('Delete and start over', 'extendify-local')}
			</Button>
		</>
	);
};
