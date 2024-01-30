import { __ } from '@wordpress/i18n';
import { AI_HOST } from '../../constants.js';

// Optionally add items to request body
const denyList = ['nonce', 'api'];
const extraBody = {
	...Object.fromEntries(
		Object.entries(window.extDraftData).filter(
			([key]) => !denyList.includes(key),
		),
	),
};

export const completion = async (prompt, promptType, systemMessageKey) => {
	const response = await fetch(`${AI_HOST}/api/draft/completion`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			prompt,
			promptType,
			systemMessageKey,
			...extraBody,
		}),
	});

	if (!response.ok) {
		if (response.status === 429) {
			throw new Error(__('Service temporarily unavailable', 'extendify-local'));
		}
		throw new Error(`Server error: ${response.status}`);
	}

	return response;
};
