export const isOnLaunch = () => {
	const q = new URLSearchParams(window.location.search);
	return ['page'].includes(q.get('extendify-launch'));
};

export const hasPageCreatorEnabled =
	window.extSharedData?.showAIPageCreation &&
	window.extSharedData?.isLaunchCompleted;
