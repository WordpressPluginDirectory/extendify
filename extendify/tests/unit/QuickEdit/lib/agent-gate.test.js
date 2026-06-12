// Net-new helper in the rebuild — mirrors DOMHighlighter's eligibility
// gates so the Ask AI pill only surfaces on blocks the agent's selector
// tool would have accepted. The existing
// src/QuickEdit/lib/__tests__/hover-bar.test.js (misnamed; it actually
// covers this module) pins the happy path; this file fills the gaps
// (null safety, the three TAGGED_INNER_SEL selectors, post-* prefix).

import { isAgentEligibleForTarget } from '@quick-edit/lib/agent-gate';

const makeTarget = (el, overrides = {}) => ({
	el,
	blockType: 'core/group',
	source: { kind: 'post', id: 1 },
	...overrides,
});

describe('isAgentEligibleForTarget — null safety', () => {
	it('returns false for a null target', () => {
		expect(isAgentEligibleForTarget(null)).toBe(false);
	});

	it('returns false for an undefined target', () => {
		expect(isAgentEligibleForTarget(undefined)).toBe(false);
	});

	it('returns false when target.el is missing', () => {
		expect(isAgentEligibleForTarget({ blockType: 'core/paragraph' })).toBe(
			false,
		);
	});

	it('returns false when target.el has no classList', () => {
		expect(isAgentEligibleForTarget(makeTarget({}))).toBe(false);
	});
});

describe('isAgentEligibleForTarget — IGNORED_CLASS_RX', () => {
	it('rejects any wp-block-post-* class (the prefix is wildcarded)', () => {
		for (const cls of [
			'wp-block-post-title',
			'wp-block-post-author',
			'wp-block-post-date',
			'wp-block-post-terms',
			'wp-block-post-excerpt',
			'wp-block-post-featured-image',
		]) {
			const el = document.createElement('div');
			el.classList.add(cls);
			expect(isAgentEligibleForTarget(makeTarget(el))).toBe(false);
		}
	});

	it('rejects on any one matching class even when others would pass', () => {
		const el = document.createElement('div');
		el.classList.add('wp-block-group');
		el.classList.add('wp-block-spacer');
		expect(isAgentEligibleForTarget(makeTarget(el))).toBe(false);
	});
});

describe('isAgentEligibleForTarget — inner-block counting', () => {
	const addInner = (parent, attr) => {
		const child = document.createElement('div');
		child.setAttribute(attr, '1');
		parent.appendChild(child);
	};

	it('counts data-extendify-part-block-id descendants', () => {
		const el = document.createElement('div');
		el.classList.add('wp-block-group');
		for (let i = 0; i < 51; i++) addInner(el, 'data-extendify-part-block-id');
		expect(isAgentEligibleForTarget(makeTarget(el))).toBe(false);
	});

	it('counts .wp-block-navigation descendants', () => {
		const el = document.createElement('div');
		el.classList.add('wp-block-group');
		for (let i = 0; i < 51; i++) {
			const nav = document.createElement('nav');
			nav.classList.add('wp-block-navigation');
			el.appendChild(nav);
		}
		expect(isAgentEligibleForTarget(makeTarget(el))).toBe(false);
	});

	it('sums across the three tagged-inner selectors', () => {
		const el = document.createElement('div');
		el.classList.add('wp-block-group');
		for (let i = 0; i < 20; i++) addInner(el, 'data-extendify-agent-block-id');
		for (let i = 0; i < 20; i++) addInner(el, 'data-extendify-part-block-id');
		for (let i = 0; i < 11; i++) {
			const nav = document.createElement('nav');
			nav.classList.add('wp-block-navigation');
			el.appendChild(nav);
		}
		expect(isAgentEligibleForTarget(makeTarget(el))).toBe(false);
	});

	it('accepts at exactly 50 inner tagged blocks (boundary)', () => {
		const el = document.createElement('div');
		el.classList.add('wp-block-group');
		for (let i = 0; i < 50; i++) addInner(el, 'data-extendify-agent-block-id');
		expect(isAgentEligibleForTarget(makeTarget(el))).toBe(true);
	});
});
