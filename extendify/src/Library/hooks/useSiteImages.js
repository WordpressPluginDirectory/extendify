import { getSiteImages } from '@library/api/WPApi';
import useSWRImmutable from 'swr/immutable';

export const useSiteImages = () => {
	const { data, error, isLoading } = useSWRImmutable(
		'library-site-images',
		getSiteImages,
	);
	return { siteImages: data?.siteImages ?? [], error, isLoading };
};
