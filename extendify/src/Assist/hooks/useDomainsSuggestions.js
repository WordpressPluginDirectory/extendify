import useSWRImmutable from 'swr/immutable';
import { siteTitle as query, tldList as tlds } from '@assist/lib/domains';
import { AI_HOST } from '../../constants';

const fetcher = async (cacheKey) => {
	const wpVersion = window.extSharedData.wpVersion || null;
	const { wpLanguage, siteId, devbuild, partnerId } = window.extAssistData;

	const urlParams = new URLSearchParams({
		query,
		wpLanguage,
		siteId,
		devbuild,
		tlds,
		partnerId,
		wpVersion,
		// Bust the cache when the user interacts
		'cache-key': cacheKey,
	});

	const response = await fetch(
		`${AI_HOST}/api/domains/suggest?${urlParams.toString()}`,
	);

	if (!response.ok) {
		throw new Error('Please try again later');
	}

	return await response.json();
};

export const useDomainsSuggestions = ({ cacheKey }) => {
	const { data, error, isLoading } = useSWRImmutable(
		'domains-suggestions',
		() => fetcher(cacheKey),
	);

	return { data, error, isLoading };
};
