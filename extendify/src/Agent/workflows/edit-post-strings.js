import { UpdatePostConfirm } from '@agent/components/workflows/UpdatePostConfirm';

const { context, abilities } = window.extAgentData;

export default {
	available: () =>
		abilities?.canEditPosts &&
		!context?.adminPage &&
		context?.postId &&
		!context?.isBlogPage,
	id: 'edit-post-strings',
	whenFinished: { component: UpdatePostConfirm },
};
