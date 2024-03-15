import { __ } from '@wordpress/i18n';
import { AI_HOST } from '../../constants.js';

// Additional data to send with requests
const allowList = [
	'siteId',
	'partnerId',
	'wpVersion',
	'wpLanguage',
	'devbuild',
	'isBlockTheme',
	'showAIConsent',
	'userGaveConsent',
	'userId',
	'globalState',
];
const extraBody = {
	...Object.fromEntries(
		Object.entries(window.extDraftData).filter(([key]) =>
			allowList.includes(key),
		),
	),
};

export const completion = async (
	prompt,
	promptType,
	systemMessageKey,
	details,
) => {
	const response = await fetch(`${AI_HOST}/api/draft/completion`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			prompt,
			promptType,
			systemMessageKey,
			details,
			...extraBody,
		}),
	});

	if (!response.ok) {
		throw new Error(__('Service temporarily unavailable', 'extendify-local'));
	}

	return response;
};

export const generateImage = async (prompt, signal) => {
	const response = await fetch(`${AI_HOST}/api/draft/image`, {
		method: 'POST',
		mode: 'cors',
		headers: {
			'Content-Type': 'application/json',
		},
		signal: signal,
		body: JSON.stringify({ prompt, ...extraBody }),
	});

	const body = await response.json();

	const imageCredits = {
		remaining: response.headers.get('x-ratelimit-remaining'),
		total: response.headers.get('x-ratelimit-limit'),
		refresh: response.headers.get('x-ratelimit-reset'),
	};

	if (!response.ok) {
		if (body.status && body.status === 'content-policy-violation') {
			throw {
				message: __(
					'Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowed by our safety system.',
					'extendify-local',
				),
				imageCredits,
			};
		}
		throw {
			message: __('Service temporarily unavailable', 'extendify-local'),
			imageCredits,
		};
	}
	return { images: body, imageCredits };
};
