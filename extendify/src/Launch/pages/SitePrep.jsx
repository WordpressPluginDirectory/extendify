import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { updateOption } from '@launch/api/WPApi';
import { Title } from '@launch/components/Title';
import { VideoPlayer } from '@launch/components/VideoPlayer';
import { useGoals } from '@launch/hooks/useGoals';
import { useSiteLogo } from '@launch/hooks/useSiteLogo';
import { useSiteProfile } from '@launch/hooks/useSiteProfile';
import { PageLayout } from '@launch/layouts/PageLayout';
import { usePagesStore } from '@launch/state/Pages';
import { pageState } from '@launch/state/factory';
import { useUserSelectionStore } from '@launch/state/user-selections';

export const state = pageState('Content Gathering', () => ({
	ready: true,
	canSkip: false,
	useNav: false,
	onRemove: () => {},
}));

export const SitePrep = () => {
	const { nextPage } = usePagesStore();
	const { setSiteProfile, addMany } = useUserSelectionStore();
	const { siteProfile } = useSiteProfile();
	const { goals } = useGoals();
	useSiteLogo();

	useEffect(() => {
		if (!siteProfile) return;
		setSiteProfile(siteProfile);
		updateOption('extendify_site_profile', siteProfile);
	}, [siteProfile, setSiteProfile]);

	useEffect(() => {
		if (!goals) return;
		if (goals) {
			addMany('goals', goals, { clearExisting: true });
		}
		let id = setTimeout(nextPage, 1000);
		return () => clearTimeout(id);
	}, [goals, nextPage, addMany]);

	return (
		<PageLayout>
			<div className="mx-auto grow overflow-y-auto px-4 py-8 md:p-12 md:px-6 3xl:p-16">
				<div className="mx-auto flex h-full flex-col justify-center">
					<VideoPlayer
						poster={`${window.extSharedData.assetPath}/data-processing.webp`}
						path="https://images.extendify-cdn.com/launch/data-processing.webm"
						className="mx-auto h-auto w-72 md:h-[288px]"
					/>

					<Title
						title={__('Customizing Your Experience', 'extendify-local')}
						description={__(
							'Please wait while we analyze your inputs and tailor your experience.',
							'extendify-local',
						)}
					/>
				</div>
			</div>
		</PageLayout>
	);
};
