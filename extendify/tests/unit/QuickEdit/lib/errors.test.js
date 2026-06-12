// friendlyMessage collapses any Quick Edit save/load error down to one of two
// user-facing strings: an expired-session message when WP core rejects the
// REST nonce (rest_cookie_invalid_nonce), and a generic catch-all for
// everything else. The raw err.message keeps flowing to insights via track();
// only the displayed string is collapsed here.

import { friendlyMessage } from '@quick-edit/lib/errors';

const GENERIC =
	'Sorry, something went wrong. Please try again or try editing something else.';
const SESSION = 'Your session expired. Please refresh the page and try again.';

describe('friendlyMessage', () => {
	it('returns the session-expiry message for a rest_cookie_invalid_nonce body', () => {
		const err = new Error('Cookie check failed');
		err.status = 403;
		err.body = {
			code: 'rest_cookie_invalid_nonce',
			message: 'Cookie check failed',
		};
		expect(friendlyMessage(err)).toBe(SESSION);
	});

	it('returns the generic message for a raw backend error body', () => {
		const err = new Error('rawBlock must parse to exactly one block');
		err.status = 400;
		err.body = { error: 'rawBlock must parse to exactly one block' };
		expect(friendlyMessage(err)).toBe(GENERIC);
	});

	it('returns the generic message for an error with no body', () => {
		expect(friendlyMessage(new Error('Splice failed'))).toBe(GENERIC);
	});

	it('returns the generic message when called with no error', () => {
		expect(friendlyMessage()).toBe(GENERIC);
	});
});
