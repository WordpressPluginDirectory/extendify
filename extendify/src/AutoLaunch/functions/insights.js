import { INSIGHTS_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';

const headers = {
	'Content-type': 'application/json',
	Accept: 'application/json',
	'X-Extendify': 'true',
};

const { urlParams } = window.extLaunchData;
export const checkIn = ({
	stage,
	siteProfile = {},
	sitePlugins = [],
	siteStyle = {},
} = {}) => {
	const { type, category, structure, objective } = siteProfile;
	const { siteId, partnerId, homeUrl, wpLanguage } = reqDataBasics;

	return fetch(`${INSIGHTS_HOST}/api/v1/launch`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			...reqDataBasics,
			autoLaunch: true,
			stage,
			skippedDescription: Boolean(urlParams?.title || urlParams?.description),
			insightsId: siteId,
			hostpartner: partnerId,
			siteURL: homeUrl,
			language: wpLanguage,
			sitePlugins: sitePlugins?.map((p) => p?.name),
			urlParameters: urlParams,
			siteStyle,
			style: siteStyle?.colorPalette,
			siteProfile,
			siteType: type,
			siteCategory: category,
			siteStructure: structure,
			siteObjective: objective,
			extra: {
				userAgent: window?.navigator?.userAgent,
				vendor: window?.navigator?.vendor || 'unknown',
				platform:
					window?.navigator?.userAgentData?.platform ||
					window?.navigator?.platform ||
					'unknown',
				mobile: window?.navigator?.userAgentData?.mobile,
				width: window.innerWidth,
				height: window.innerHeight,
				screenHeight: window.screen.height,
				screenWidth: window.screen.width,
				orientation: window.screen.orientation?.type,
				touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
			},
		}),
	});
};
