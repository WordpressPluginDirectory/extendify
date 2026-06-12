import { applyDesignBuildOrder } from '@auto-launch/fetchers/get-design-build';
import { getPagesShape, pageTemplateShape } from '@auto-launch/fetchers/shape';
import {
	fetchWithTimeout,
	retryTwice,
	setStatus,
} from '@auto-launch/functions/helpers';
import { PATTERNS_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';
import { __ } from '@wordpress/i18n';
import { z } from 'zod';

const url = `${PATTERNS_HOST}/api/page-templates`;
const method = 'POST';
const headers = { 'Content-Type': 'application/json' };

const shapeLocal = z.looseObject({
	recommended: z.array(pageTemplateShape),
});

export const handlePages = async ({
	siteProfile,
	sitePlugins,
	siteStyle,
	siteImages,
	designBuild,
}) => {
	if (siteProfile.structure !== 'multi-page') {
		return { pages: [] };
	}

	// translators: this is for a action log UI. Keep it short
	setStatus(__('Preparing your pages', 'extendify-local'));

	const body = JSON.stringify({
		...reqDataBasics,
		siteProfile,
		siteStyle,
		siteImages: { siteImages },
		sitePlugins,
		includeOptional: false,
		// If pages are passed in they may be used
		pages: designBuild?.pages ?? [],
		buildId: designBuild?.buildId,
	});

	const response = await retryTwice(() =>
		fetchWithTimeout(url, { method, headers, body }),
	);
	const template = shapeLocal.parse(await response.json());
	const pages = applyDesignBuildOrder(template.recommended, designBuild);

	return getPagesShape.parse({ pages });
};
