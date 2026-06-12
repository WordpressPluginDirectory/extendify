// Lets non-React callers (hover-bar's click rule, Agent's chat submit)
// trigger the QE canvas's save. Without this, every implicit-close gesture
// — cross-block click, click-outside, Ask AI pill, agent chat submit —
// silently discards the user's in-flight edits.
//
// BlockTextEditor registers its `handleSave` on mount. The bridge stays a
// no-op when nothing is registered (no QE canvas open) so callers can
// fire-and-forget.
//
// Cross-block click passes `alsoClear: false` so handleSave skips its
// final `clearSelected()` — the new click is already calling
// `setSelected(B)` synchronously after, and we don't want the async save
// completion to overwrite B with null.

let saver = null;

export const registerSaver = (fn) => {
	saver = fn;
};

export const unregisterSaver = (fn) => {
	if (saver === fn) saver = null;
};

export const hasSaver = () => !!saver;

export const saveSelected = (options = {}) => {
	if (!saver) return Promise.resolve();
	return Promise.resolve(saver(options));
};

export const AGENT_SUBMIT_EVENT = 'extendify-quick-edit:agent-submit';

if (typeof window !== 'undefined') {
	window.addEventListener(AGENT_SUBMIT_EVENT, () => {
		if (saver) saver({ alsoClear: true });
	});
}
