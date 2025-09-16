import { UpdateBlockConfirm } from '@agent/workflows/dom-highlighter/components/UpdateBlockConfirm';

const { context, abilities } = window.extAgentData;

export default {
	available: () =>
		abilities?.canEditPosts &&
		!context?.adminPage &&
		context?.postId &&
		!context?.isBlogPage &&
		context?.isBlockTheme &&
		document.querySelector('.wp-site-blocks'),
	id: 'edit-block-content',
	requires: ['block'],
	whenFinished: { component: UpdateBlockConfirm },
};
