import { useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { generateCustomContent } from '@page-creator/api/DataApi';
import { usePageLayout } from '@page-creator/hooks/usePageLayout';
import { usePageProfile } from '@page-creator/hooks/usePageProfile';
import { useGlobalsStore } from '@page-creator/state/global';
import { replaceThemeVariables } from '@page-creator/util/replaceThemeVariables';
import { safeParseJson } from '@shared/lib/parsing';
import useSWRImmutable from 'swr/immutable';

const { state } = safeParseJson(
	window.extSharedData?.userData?.userSelectionData,
);

const siteId = window.extSharedData.siteId;
const currentTheme = window.extSharedData?.themeSlug || 'extendable';

export const usePageCustomContent = () => {
	const { pageProfile } = usePageProfile();
	const { template } = usePageLayout();
	const { setProgress, regenerationCount } = useGlobalsStore();
	const loading = !pageProfile || !template;

	const params = {
		key: `page-creator-page-custom-content-${regenerationCount}`,
		pageProfile,
		userState: {
			businessInformation: state?.businessInformation,
			goals: state?.goals,
			siteInformation: state?.siteInformation,
			siteId,
		},
		page: template,
	};

	const { data, error } = useSWRImmutable(
		loading ? null : params,
		generateCustomContent,
	);

	useEffect(() => {
		if (loading) return;
		setProgress(__('Writing custom content...', 'extendify-local'));
	}, [data, setProgress, loading]);

	const themeAdjustedPatterns = useMemo(() => {
		if (!data?.patterns) return [];
		return data.patterns.map((pattern) => ({
			...pattern,
			code: replaceThemeVariables(pattern.code, currentTheme),
		}));
	}, [data?.patterns]);

	return {
		page: data
			? {
					patterns: themeAdjustedPatterns,
					title: pageProfile.aiTitle,
				}
			: data,
		error,
		loading: !data && !error,
	};
};
