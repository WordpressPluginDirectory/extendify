import useSWRImmutable from 'swr/immutable';
import { getThemeVariations as fetcher } from '@agent/tools/get-theme-variations';

export const useThemeVariations = () => {
	const { data, error, isLoading } = useSWRImmutable(
		{
			key: 'theme-variations',
			themeSlug: window.extAgentData.context.themeSlug,
		},
		fetcher,
	);
	return { variations: data?.variations, error, isLoading };
};
