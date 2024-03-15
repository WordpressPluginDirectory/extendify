const recommendations =
	window.extAssistData?.resourceData?.recommendations || {};

const adminUrl = window.extSharedData.adminUrl || '';

export const useRecommendations = () => {
	return recommendations.map((recommendation) => {
		return { adminUrl, ...recommendation };
	});
};
