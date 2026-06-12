import { __, sprintf } from '@wordpress/i18n';
import { resolveTarget } from './dom';
import {
	askAiTarget,
	editTarget,
	hideBar,
	pillContextFor,
	showBar,
} from './hover-bar';

const SELECTOR = [
	'[data-extendify-agent-block-id]',
	'[data-extendify-part-block-id]',
	// Product/wpforms taggers write these; the agent's tagger doesn't reach those.
	'[data-extendify-quick-edit-product-id]',
	'[data-extendify-quick-edit-wpform-field-id]',
].join(',');

const KB_READY_ATTR = 'data-extendify-quick-edit-kb-ready';
const PREV_TAB_ATTR = 'data-extendify-quick-edit-kb-prev-tab';
const PREV_ROLE_ATTR = 'data-extendify-quick-edit-kb-prev-role';
const PREV_ARIA_ATTR = 'data-extendify-quick-edit-kb-prev-aria';

let attached = false;
let onFocusIn = null;
let onFocusOut = null;
let onActivate = null;

const findTagged = (start) => {
	let node = start;
	while (node && node.nodeType === 1 && node !== document.body) {
		if (node.matches?.(SELECTOR)) return node;
		node = node.parentElement;
	}
	return null;
};

const buildAriaLabel = (el, target, { quickEditable, aiAvailable }) => {
	const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
	const snippet = text.length > 60 ? `${text.substring(0, 60)}…` : text;
	// Ask-AI-only blocks (group / columns / media-text) route Enter to the
	// agent, so announce that action rather than "Edit".
	if (aiAvailable && !quickEditable) {
		return snippet
			? sprintf(
					// translators: %s is a snippet of the block's text content.
					__('Ask AI about "%s"', 'extendify-local'),
					snippet,
				)
			: __('Ask AI', 'extendify-local');
	}
	const verb =
		target?.blockType === 'core/image' || target?.blockType === 'core/cover'
			? __('Replace image', 'extendify-local')
			: __('Edit', 'extendify-local');
	return snippet
		? sprintf(
				// translators: %1$s is the action verb (Edit / Replace image), %2$s is a snippet of the block's text content.
				__('%1$s "%2$s"', 'extendify-local'),
				verb,
				snippet,
			)
		: verb;
};

// Skips role="button" on headings/links/landmarks so SR users
// retain heading/link/landmark navigation. Enter/Space still
// activates regardless of role.
const decorate = () => {
	for (const el of document.querySelectorAll(SELECTOR)) {
		if (el.getAttribute(KB_READY_ATTR) === '1') continue;
		// Empty-string sentinel distinguishes "wasn't set" from "was empty".
		el.setAttribute(
			PREV_TAB_ATTR,
			el.hasAttribute('tabindex') ? el.getAttribute('tabindex') : '',
		);
		el.setAttribute(
			PREV_ROLE_ATTR,
			el.hasAttribute('role') ? el.getAttribute('role') : '',
		);
		el.setAttribute(
			PREV_ARIA_ATTR,
			el.hasAttribute('aria-label') ? el.getAttribute('aria-label') : '',
		);
		el.setAttribute('tabindex', '0');

		const tag = el.tagName;
		const isHeading = /^H[1-6]$/.test(tag);
		const isLink = tag === 'A';
		const isLandmark = [
			'NAV',
			'HEADER',
			'MAIN',
			'FOOTER',
			'ASIDE',
			'SECTION',
		].includes(tag);
		if (!isHeading && !isLink && !isLandmark) {
			el.setAttribute('role', 'button');
		}

		const target = resolveTarget(el);
		el.setAttribute(
			'aria-label',
			buildAriaLabel(el, target, pillContextFor(target)),
		);
		el.setAttribute(KB_READY_ATTR, '1');
	}
};

const undecorate = () => {
	for (const el of document.querySelectorAll(`[${KB_READY_ATTR}="1"]`)) {
		const restore = (prevAttr, attr) => {
			const prev = el.getAttribute(prevAttr);
			if (prev !== '' && prev !== null) {
				el.setAttribute(attr, prev);
			} else {
				el.removeAttribute(attr);
			}
			el.removeAttribute(prevAttr);
		};
		restore(PREV_TAB_ATTR, 'tabindex');
		restore(PREV_ROLE_ATTR, 'role');
		restore(PREV_ARIA_ATTR, 'aria-label');
		el.removeAttribute(KB_READY_ATTR);
	}
};

export const attachKeyboardEntry = ({ getSession }) => {
	if (attached) return;
	attached = true;

	decorate();

	onFocusIn = (e) => {
		if (getSession?.()) return;
		const el = findTagged(e.target);
		if (!el) return;
		hideBar();
		showBar(el);
	};

	onFocusOut = (e) => {
		// Capture the focused element so we can detect "the element was
		// removed from the DOM" inside the setTimeout below. The Esc-on-
		// QE-canvas gesture hits this path: the canvas's editable holds
		// focus, Esc clears `selected`, hover-bar's subscriber re-renders
		// the bar synchronously, then React commits the unmount in a
		// later microtask — by setTimeout(0) time the editable is gone
		// but the bar is fresh. The body-focus branch below would
		// otherwise tear that fresh bar down.
		const target = e.target;
		setTimeout(() => {
			if (getSession?.()) return;
			// Image-picker / modal popovers steal focus on mount.
			if (
				document.querySelector(
					'.extendify-quick-edit-image-menu, .extendify-quick-edit-floating-bar',
				)
			) {
				return;
			}
			if (target && !document.body.contains(target)) return;
			const active = document.activeElement;
			if (!active || active === document.body) {
				hideBar();
				return;
			}
			if (findTagged(active)) return;
			hideBar();
		}, 0);
	};

	onActivate = (e) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (getSession?.()) return;
		const el = findTagged(e.target);
		if (!el) return;
		// Skip activation when the keystroke came from a child with
		// its own action (e.g. a link inside a nav item).
		if (e.target !== el) return;
		const target = resolveTarget(el);
		if (!target?.blockType) return;
		e.preventDefault();
		const { quickEditable, aiAvailable } = pillContextFor(target);
		// Quick-editable blocks open the inline editor (picker types need the
		// bar mounted first so the dropdown can anchor to it).
		if (quickEditable) {
			showBar(el);
			editTarget(target);
			return;
		}
		// Ask-AI-only blocks (group / columns / media-text) have no editor to
		// open; route Enter straight to the agent like the Ask AI pill does.
		if (aiAvailable) {
			askAiTarget(el);
			return;
		}
		showBar(el);
	};

	document.addEventListener('focusin', onFocusIn, true);
	document.addEventListener('focusout', onFocusOut, true);
	document.addEventListener('keydown', onActivate, true);
};

export const detachKeyboardEntry = () => {
	if (!attached) return;
	attached = false;
	document.removeEventListener('focusin', onFocusIn, true);
	document.removeEventListener('focusout', onFocusOut, true);
	document.removeEventListener('keydown', onActivate, true);
	onFocusIn = null;
	onFocusOut = null;
	onActivate = null;
	undecorate();
};
