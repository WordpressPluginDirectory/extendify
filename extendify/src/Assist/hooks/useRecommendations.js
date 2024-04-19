import { safeParseJson } from '@assist/lib/parsing';

const recommendations =
	safeParseJson(window.extAssistData.resourceData)?.recommendations || {};

const adminUrl = window.extSharedData.adminUrl || '';

export const useRecommendations = () => {
	return recommendations.map((recommendation) => {
		return { adminUrl, ...recommendation };
	});
};
