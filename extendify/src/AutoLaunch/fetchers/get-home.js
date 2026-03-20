import { getHomeShape, homeTemplateShape } from '@auto-launch/fetchers/shape';
import {
	fetchWithTimeout,
	retryTwice,
	setStatus,
} from '@auto-launch/functions/helpers';
import { getHeadersAndFooters } from '@auto-launch/functions/wp';
import { PATTERNS_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';
import { __ } from '@wordpress/i18n';

const { wpLanguage, showImprint } = window.extSharedData;
const url = `${PATTERNS_HOST}/api/home`;
const method = 'POST';
const headers = { 'Content-Type': 'application/json' };

export const handleHome = async ({
	siteProfile,
	sitePlugins,
	siteImages,
	aiHeaders,
}) => {
	// translators: this is for a action log UI. Keep it short
	setStatus(__('Preparing your home page', 'extendify-local'));

	const body = JSON.stringify({
		...reqDataBasics,
		siteProfile,
		siteImages,
		sitePlugins,
		aiHeaders,
	});

	const response = await retryTwice(() =>
		fetchWithTimeout(url, { method, headers, body }),
	);
	const template = homeTemplateShape.parse(await response.json());

	// Check if we should show footer navigation
	// This is based on the imprint page and the language of the site
	const hasFooterNav = Array.isArray(showImprint)
		? showImprint.includes(wpLanguage ?? '') &&
			siteProfile.category === 'Business'
		: false;

	const { headers: head, footers: foot } =
		await getHeadersAndFooters(hasFooterNav);
	const headerCode = head[0]?.content?.raw?.trim() ?? '';
	const footerCode = foot[0]?.content?.raw?.trim() ?? '';
	return getHomeShape.parse({ home: { ...template, headerCode, footerCode } });
};
