import apiFetch from '@wordpress/api-fetch';
import { useEffect } from '@wordpress/element';

export const useLockPost = ({ postId, enabled }) => {
	useEffect(() => {
		if (!postId || !enabled) return;
		let timeoutId;
		const lockPost = async () => {
			await apiFetch({
				path: '/extendify/v1/agent/lock-post',
				method: 'POST',
				data: { postId },
			}).catch(() => undefined);
			// lock auto removes every 15 minutes
			timeoutId = setTimeout(lockPost, 14 * 60 * 1000);
		};
		lockPost();
		return () => clearTimeout(timeoutId);
	}, [postId, enabled]);
};
