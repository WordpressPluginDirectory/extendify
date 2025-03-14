import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getGeneratedPageTemplate } from '@page-creator/api/DataApi';
import { usePageProfile } from '@page-creator/hooks/usePageProfile';
import { useSiteImages } from '@page-creator/hooks/useSiteImages';
import { useGlobalsStore } from '@page-creator/state/global';
import useSWRImmutable from 'swr/immutable';

export const usePageLayout = () => {
	const { pageProfile } = usePageProfile();
	const { siteImages } = useSiteImages();
	const loading = !pageProfile || !siteImages;
	const { setProgress, regenerationCount } = useGlobalsStore();

	const params = {
		key: `page-creator-page-layout-${regenerationCount}`,
		pageProfile,
		siteImages,
	};

	const { data, error } = useSWRImmutable(
		loading ? null : params,
		getGeneratedPageTemplate,
	);

	useEffect(() => {
		if (data) return;
		setProgress(__('Creating a custom layout...', 'extendify-local'));
	}, [data, setProgress]);

	return { template: data?.template ?? data, error, loading: !data && !error };
};
