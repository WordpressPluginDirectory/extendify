// Mirrors DOMHighlighter's eligibility gates so the Ask AI pill only
// surfaces on blocks the agent's selector tool would have accepted —
// keeps the two selectors in lockstep until DOMHighlighter shrinks to
// a passive renderer.
const IGNORED_CLASS_RX = /^(wp-block-video|wp-block-spacer|wp-block-post-.*)$/;
const TAGGED_INNER_SEL =
	'[data-extendify-agent-block-id], [data-extendify-part-block-id], .wp-block-navigation';
const MAX_INNER_TAGGED = 50;

export const isAgentEligibleForTarget = (target) => {
	const el = target?.el;
	if (!el?.classList) return false;
	for (const cls of el.classList) {
		if (IGNORED_CLASS_RX.test(cls)) return false;
	}
	if (el.querySelectorAll(TAGGED_INNER_SEL).length > MAX_INNER_TAGGED) {
		return false;
	}
	return true;
};
