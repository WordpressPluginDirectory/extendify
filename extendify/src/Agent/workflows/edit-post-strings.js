import { RedirectStrings } from '@agent/components/redirects/RedirectStrings';
import { UpdatePostConfirm } from '@agent/components/workflows/UpdatePostConfirm';

const { context, abilities } = window.extAgentData;

export default {
	available: () =>
		abilities?.canEditPosts &&
		!context?.adminPage &&
		context?.postId &&
		!context?.isBlogPage,
	needsRedirect: () => !Number(context?.postId || 0),
	redirectComponent: RedirectStrings,
	id: 'edit-post-strings',
	whenFinished: { component: UpdatePostConfirm },
};
