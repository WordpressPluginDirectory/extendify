// Pins the capture-phase click rule:
// anchor → navigate, pill/toolbar → pass through, form control → focus,
// tagged block → select (with innermost-tagged), outside → clear.
//
// The decision function is pure — given a target node, returns the
// branch the listener should take. The listener wiring (preventDefault,
// stopPropagation, hover-bar render/clear) lives in hover-bar.js and is
// exercised by the Playwright spec.

import { decideClickAction } from '@quick-edit/lib/click-rule';

beforeEach(() => {
	document.body.innerHTML = '';
});

const make = (tag, attrs = {}, classes = []) => {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	for (const cls of classes) el.classList.add(cls);
	return el;
};

describe('decideClickAction — null safety', () => {
	it('returns ignore for null', () => {
		expect(decideClickAction(null)).toEqual({ action: 'ignore' });
	});

	it('returns ignore for a text node target', () => {
		const text = document.createTextNode('x');
		expect(decideClickAction(text)).toEqual({ action: 'ignore' });
	});
});

describe('decideClickAction — navigate beats everything', () => {
	it('returns navigate for an <a href> target', () => {
		const a = make('a', { href: '/about' });
		document.body.appendChild(a);
		expect(decideClickAction(a)).toEqual({ action: 'navigate' });
	});

	it('returns navigate for a descendant of <a href>', () => {
		const a = make('a', { href: '/about' });
		const span = make('span');
		a.appendChild(span);
		document.body.appendChild(a);
		expect(decideClickAction(span)).toEqual({ action: 'navigate' });
	});

	it('returns navigate for an anchor inside a tagged block (anchor wins)', () => {
		const block = make('section', { 'data-extendify-agent-block-id': '7' });
		const a = make('a', { href: '/contact' });
		block.appendChild(a);
		document.body.appendChild(block);
		expect(decideClickAction(a)).toEqual({ action: 'navigate' });
	});

	it('does not return navigate for an <a> without href', () => {
		const a = make('a');
		document.body.appendChild(a);
		expect(decideClickAction(a)).toEqual({ action: 'clear' });
	});
});

describe('decideClickAction — pill / toolbar pass-through', () => {
	it('returns pill for a button with data-extendify-quick-edit-pill', () => {
		const btn = make('button', { 'data-extendify-quick-edit-pill': '' });
		document.body.appendChild(btn);
		expect(decideClickAction(btn)).toEqual({ action: 'pill' });
	});

	it('returns pill for a span inside a data-extendify-quick-edit-bar wrapper', () => {
		const bar = make('div', { 'data-extendify-quick-edit-bar': '' });
		const inner = make('span');
		bar.appendChild(inner);
		document.body.appendChild(bar);
		expect(decideClickAction(inner)).toEqual({ action: 'pill' });
	});

	it('returns pill (not select) when a pill sits inside a tagged block', () => {
		const block = make('div', { 'data-extendify-agent-block-id': '4' });
		const pill = make('button', { 'data-extendify-quick-edit-pill': '' });
		block.appendChild(pill);
		document.body.appendChild(block);
		expect(decideClickAction(pill)).toEqual({ action: 'pill' });
	});
});

describe('decideClickAction — form controls focus', () => {
	it.each([
		'input',
		'textarea',
		'select',
		'button',
	])('returns focus-control for a bare <%s>', (tag) => {
		const el = make(tag);
		document.body.appendChild(el);
		expect(decideClickAction(el)).toEqual({ action: 'focus-control' });
	});

	it('returns focus-control for a form control inside a tagged block', () => {
		const block = make('div', { 'data-extendify-agent-block-id': '3' });
		const input = make('input', { type: 'search' });
		block.appendChild(input);
		document.body.appendChild(block);
		expect(decideClickAction(input)).toEqual({ action: 'focus-control' });
	});
});

describe('decideClickAction — tagged-block select', () => {
	it('returns select for a click directly on a tagged block', () => {
		const block = make('div', { 'data-extendify-agent-block-id': '11' });
		document.body.appendChild(block);
		expect(decideClickAction(block)).toEqual({ action: 'select', el: block });
	});

	it('returns select with the innermost tagged ancestor', () => {
		const outer = make('section', { 'data-extendify-agent-block-id': '1' });
		const inner = make('div', { 'data-extendify-part-block-id': '2' });
		const leaf = make('p');
		inner.appendChild(leaf);
		outer.appendChild(inner);
		document.body.appendChild(outer);
		expect(decideClickAction(leaf)).toEqual({ action: 'select', el: inner });
	});

	it('returns select for the WPForm-field-tagged ancestor', () => {
		const block = make('div', {
			'data-extendify-quick-edit-wpform-field-id': '7',
		});
		const label = make('label');
		block.appendChild(label);
		document.body.appendChild(block);
		expect(decideClickAction(label)).toEqual({ action: 'select', el: block });
	});

	it('returns select for the product-tagged ancestor', () => {
		const block = make('div', {
			'data-extendify-quick-edit-product-id': '99',
		});
		const inner = make('span');
		block.appendChild(inner);
		document.body.appendChild(block);
		expect(decideClickAction(inner)).toEqual({ action: 'select', el: block });
	});
});

describe('decideClickAction — clear', () => {
	it('returns clear for a click outside every tagged block', () => {
		const body = make('p', {}, ['random']);
		document.body.appendChild(body);
		expect(decideClickAction(body)).toEqual({ action: 'clear' });
	});
});
