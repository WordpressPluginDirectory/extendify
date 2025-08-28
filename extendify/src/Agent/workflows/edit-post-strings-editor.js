import { RedirectStrings } from '@agent/components/redirects/RedirectStrings';
import { UpdatePostConfirmEditor } from '@agent/components/workflows/UpdatePostConfirmEditor';

const { abilities, context } = window.extAgentData;

// When on the edit screen
export default {
	available: () =>
		abilities?.canEditPost &&
		context?.usingBlockEditor &&
		context?.adminPage &&
		context?.postId,
	id: 'edit-post-strings-editor',
	needsRedirect: () => !Number(context?.postId || 0),
	redirectComponent: RedirectStrings,
	whenFinished: { component: UpdatePostConfirmEditor },
};
