import { useState, useEffect, useLayoutEffect } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';
import { CustomTextarea } from '@page-creator/components/content/CustomTextarea';
import { Title } from '@page-creator/components/content/Title';
import { usePageDescriptionStore } from '@page-creator/state/cache';
import { useGlobalsStore } from '@page-creator/state/global';
import { usePagesStore } from '@page-creator/state/pages';
import { useSiteProfileStore } from '@shared/state/site-profile';

const { siteTitle } = window.extSharedData;

export const Dashboard = () => {
	const { nextPage } = usePagesStore();
	const { siteProfile, setSiteProfile } = useSiteProfileStore();
	const { setDescription, description } = usePageDescriptionStore();
	const [pageDescription, setPageDescription] = useState(description ?? '');
	const [disabled, setDisabled] = useState(true);
	const [hideEditor, setHideEditor] = useState(true);
	const { incrementRegenerationCount } = useGlobalsStore();

	const [siteDescription, setSiteDescription] = useState(
		decodeEntities(siteProfile?.aiDescription) || '',
	);

	useLayoutEffect(() => {
		if (siteDescription) return;
		setHideEditor(false);
	}, [siteDescription]);

	useEffect(() => {
		setDisabled(true);
		const timer = setTimeout(() => {
			if (pageDescription) setDescription(pageDescription);
			if (siteDescription && siteDescription !== siteProfile?.aiDescription) {
				// Persist the site profile if they edit it
				setSiteProfile({ aiDescription: siteDescription });
			}
			setDisabled(!pageDescription.length);
		}, 1000);

		return () => clearTimeout(timer);
	}, [
		setDescription,
		pageDescription,
		siteDescription,
		setDisabled,
		setSiteProfile,
		siteProfile,
	]);

	return (
		<div className="mx-auto flex max-w-xl flex-col">
			<div className="mb-12 grid grid-cols-1 gap-1 text-center">
				<Title
					title={__('AI Page Creation', 'extendify-local')}
					description={__(
						'Describe the page you want to create, adding key details, and Al will generate a unique, ready-to-use page for you.',
						'extendify-local',
					)}
				/>
			</div>
			<div className="grid grid-cols-1 gap-6">
				<CustomTextarea
					title={__('Describe Your Page', 'extendify-local')}
					required={true}
					className="input-focus h-[220px] w-full max-w-full resize-none border border-gray-600 py-3 pe-6 ps-3 text-base placeholder:italic placeholder:opacity-70"
					placeholder={__(
						'E.g., Create an "About Us" page highlighting our story, mission, values and leam overview.',
						'extendify-local',
					)}
					value={pageDescription}
					onChange={(e) => setPageDescription(e.currentTarget.value)}
				/>

				<CustomTextarea
					hideEditor={hideEditor}
					setHideEditor={setHideEditor}
					title={
						siteTitle
							? sprintf(
									__('Site Description for %s', 'extendify-local'),
									decodeEntities(siteTitle),
								)
							: __('Site Description', 'extendify-local')
					}
					className="input-focus h-[220px] w-full max-w-full resize-none border border-gray-600 py-3 pe-6 ps-3 text-base placeholder:italic placeholder:opacity-70"
					placeholder={__(
						'This is the site description with all its ups and downs.',
						'extendify-local',
					)}
					value={siteDescription}
					onChange={(e) => setSiteDescription(e.currentTarget.value)}
				/>

				<button
					type="button"
					disabled={disabled}
					onClick={() => {
						incrementRegenerationCount();
						nextPage();
					}}
					className="mt-2.5 rounded-sm bg-editor-main px-4 py-2.5 text-sm font-medium text-design-text hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300">
					{__('Generate Page', 'extendify-local')}
				</button>
			</div>
		</div>
	);
};
