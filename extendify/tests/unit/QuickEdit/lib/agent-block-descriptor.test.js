// buildAgentBlockDescriptor builds the agent-block selection envelope
// that powers Agent workflow picking. DOMHighlighter (click) and
// ask-ai (Ask AI pill) both call this — the test pins the shape so
// both surfaces resolve metadata identically.

import { buildAgentBlockDescriptor } from '@quick-edit/lib/agent-block-descriptor';

const makeBlock = ({ html = '', tagName = 'section', classes = [] } = {}) => {
	const el = document.createElement(tagName);
	el.setAttribute('data-extendify-agent-block-id', 'b-1');
	for (const c of classes) el.classList.add(c);
	if (html) el.innerHTML = html;
	return el;
};

describe('buildAgentBlockDescriptor', () => {
	it('returns null when no element is given', () => {
		expect(buildAgentBlockDescriptor(null)).toBeNull();
		expect(buildAgentBlockDescriptor(undefined)).toBeNull();
	});

	it('reads id and target from data-extendify-agent-block-id', () => {
		const el = makeBlock();
		const d = buildAgentBlockDescriptor(el);
		expect(d.id).toBe('b-1');
		expect(d.target).toBe('data-extendify-agent-block-id');
		expect(d.template).toBeUndefined();
	});

	it('detects hasText from non-whitespace text content', () => {
		const withText = makeBlock();
		withText.textContent = 'hello';
		expect(buildAgentBlockDescriptor(withText).hasText).toBe(true);

		const blank = makeBlock();
		blank.textContent = '   \n\t';
		expect(buildAgentBlockDescriptor(blank).hasText).toBe(false);
	});

	it('treats zero-width-space content as no text', () => {
		const el = makeBlock();
		el.textContent = '​​';
		expect(buildAgentBlockDescriptor(el).hasText).toBe(false);
	});

	it('detects hasLinks from descendant or self anchor', () => {
		const withChild = makeBlock({ html: '<a href="/">x</a>' });
		expect(buildAgentBlockDescriptor(withChild).hasLinks).toBe(true);

		const selfAnchor = document.createElement('a');
		selfAnchor.setAttribute('data-extendify-agent-block-id', 'b-2');
		expect(buildAgentBlockDescriptor(selfAnchor).hasLinks).toBe(true);

		const none = makeBlock();
		expect(buildAgentBlockDescriptor(none).hasLinks).toBe(false);
	});

	it('detects hasImages from .wp-block-image, img tags, and self class', () => {
		const wpBlock = makeBlock({ html: '<div class="wp-block-image"></div>' });
		expect(buildAgentBlockDescriptor(wpBlock).hasImages).toBe(true);

		const innerImg = makeBlock({ html: '<img src="x" />' });
		expect(buildAgentBlockDescriptor(innerImg).hasImages).toBe(true);

		const selfWpImage = makeBlock({ classes: ['wp-block-image'] });
		expect(buildAgentBlockDescriptor(selfWpImage).hasImages).toBe(true);

		const none = makeBlock();
		expect(buildAgentBlockDescriptor(none).hasImages).toBe(false);
	});

	it('detects hasNav / hasSiteTitle / hasSiteLogo from class or descendant class', () => {
		const allInside = makeBlock({
			html: `
				<nav class="wp-block-navigation"></nav>
				<h1 class="wp-block-site-title">Site</h1>
				<div class="wp-block-site-logo"></div>
			`,
		});
		const d = buildAgentBlockDescriptor(allInside);
		expect(d.hasNav).toBe(true);
		expect(d.hasSiteTitle).toBe(true);
		expect(d.hasSiteLogo).toBe(true);

		const navSelf = makeBlock({ classes: ['wp-block-navigation'] });
		expect(buildAgentBlockDescriptor(navSelf).hasNav).toBe(true);

		const titleSelf = makeBlock({ classes: ['wp-block-site-title'] });
		expect(buildAgentBlockDescriptor(titleSelf).hasSiteTitle).toBe(true);

		const logoSelf = makeBlock({ classes: ['wp-block-site-logo'] });
		expect(buildAgentBlockDescriptor(logoSelf).hasSiteLogo).toBe(true);

		const none = makeBlock();
		expect(none).toBeDefined();
		const d2 = buildAgentBlockDescriptor(none);
		expect(d2.hasNav).toBe(false);
		expect(d2.hasSiteTitle).toBe(false);
		expect(d2.hasSiteLogo).toBe(false);
	});

	it('promotes the template-part ancestor: id, target, and template slug', () => {
		const part = document.createElement('header');
		part.setAttribute('data-extendify-part', 'header');
		part.setAttribute('data-extendify-part-block-id', 'part-7');
		const inner = makeBlock();
		inner.textContent = 'logo+nav';
		part.appendChild(inner);

		const d = buildAgentBlockDescriptor(inner);
		expect(d.id).toBe('part-7');
		expect(d.target).toBe('data-extendify-part-block-id');
		expect(d.template).toBe('header');
		expect(d.hasText).toBe(true);
	});
});
