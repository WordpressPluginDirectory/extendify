import { handleSitePlugins } from '@auto-launch/fetchers/get-plugins';
import useSWR from 'swr/immutable';

export const useInstallRequiredPlugins = () => {
	const { data, error } = useSWR('required-plugins', () =>
		handleSitePlugins({ requiredOnly: true, showStatus: false }),
	);

	return {
		requiredPlugins: data?.selectedPlugins || [],
		isLoading: !error && !data,
		isError: error,
	};
};
