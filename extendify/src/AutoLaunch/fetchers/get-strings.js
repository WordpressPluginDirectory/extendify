import { getStringsShape } from '@auto-launch/fetchers/shape';
import {
	failWithFallback,
	fetchWithTimeout,
	retryTwice,
	setStatus,
} from '@auto-launch/functions/helpers';
import { AI_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';
import { __ } from '@wordpress/i18n';

const fallback = { aiHeaders: [], aiBlogTitles: [] };
const url = `${AI_HOST}/api/site-strings`;
const method = 'POST';
const headers = { 'Content-Type': 'application/json' };

export const handleSiteStrings = async ({ siteProfile }) => {
	// translators: this is for a action log UI. Keep it short
	setStatus(__('Generating site content ideas', 'extendify-local'));

	const body = JSON.stringify({ ...reqDataBasics, siteProfile });

	const response = await retryTwice(() =>
		fetchWithTimeout(url, { method, headers, body }),
	);

	if (!response?.ok) return fallback;

	return failWithFallback(
		async () => getStringsShape.parse(await response.json()),
		fallback,
	);
};
