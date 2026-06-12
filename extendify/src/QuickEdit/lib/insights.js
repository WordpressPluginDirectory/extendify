// keepalive: true so events queued right before navigation (e.g. an
// undo-driven reload) still ship.
import { INSIGHTS_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';

const HEADERS = {
	'Content-type': 'application/json',
	Accept: 'application/json',
	'X-Extendify': 'true',
};

const ENDPOINT = `${INSIGHTS_HOST}/api/v1/quick-edit`;

// event: snake_case. props: flat key/value, no PII.
export const track = (event, props = {}) => {
	if (!INSIGHTS_HOST || !event) return;
	try {
		fetch(ENDPOINT, {
			method: 'POST',
			headers: HEADERS,
			keepalive: true,
			body: JSON.stringify({
				...reqDataBasics,
				event,
				props,
				ts: Date.now(),
			}),
		}).catch(() => {
			/* swallow */
		});
	} catch (_e) {
		/* swallow */
	}
};
