// Pins resolveTarget's priority ladder (WPForms → product → post-block →
// template-part → nav-ref), detectBlockType's generic wp-block-* derivation,
// and splice's DOM swap (variant-class patching, attribute carry-forward,
// ext-animate removal, data-extendify-* identity preservation).

import { resolveTarget, splice } from '@quick-edit/lib/dom';

beforeEach(() => {
	delete window.extQuickEditData;
	document.body.innerHTML = '';
});

const make = (tag, attrs = {}, classes = []) => {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	for (const cls of classes) el.classList.add(cls);
	return el;
};

describe('resolveTarget — null safety', () => {
	it('returns null for a null node', () => {
		expect(resolveTarget(null)).toBeNull();
	});

	it('returns null for a node with no matching ancestor', () => {
		const orphan = make('p', {}, ['some-class']);
		document.body.appendChild(orphan);
		expect(resolveTarget(orphan)).toBeNull();
	});
});

describe('resolveTarget — priority ladder (WPForms takes precedence)', () => {
	it('returns wpforms:field when wpform-field-id + ancestor wpform-id both exist on top of an agent-block-id', () => {
		const form = make('div', { 'data-extendify-quick-edit-wpform-id': '5' });
		const field = make('div', {
			'data-extendify-quick-edit-wpform-field-id': '2',
			'data-extendify-agent-block-id': '11',
		});
		form.appendChild(field);
		document.body.appendChild(form);

		expect(resolveTarget(field)).toEqual({
			el: field,
			blockType: 'wpforms:field',
			formId: 5,
			fieldId: 2,
			source: { kind: 'wpforms', formId: 5, fieldId: 2 },
		});
	});

	it('skips the wpforms branch when no ancestor carries wpform-id', () => {
		// Plain <p> with no class — tag-name fallback kicks in.
		const orphan = make('p', {
			'data-extendify-quick-edit-wpform-field-id': '2',
			'data-extendify-agent-block-id': '11',
		});
		document.body.appendChild(orphan);
		expect(resolveTarget(orphan)).toMatchObject({
			blockId: 11,
			blockType: 'core/paragraph',
		});
	});
});

describe('resolveTarget — product field', () => {
	it('returns product:<field> over agent-block-id', () => {
		const el = make('div', {
			'data-extendify-quick-edit-product-id': '42',
			'data-extendify-quick-edit-product-field': 'name',
			'data-extendify-agent-block-id': '11',
		});
		document.body.appendChild(el);
		expect(resolveTarget(el)).toEqual({
			el,
			productId: 42,
			productField: 'name',
			blockType: 'product:name',
			source: { kind: 'product', id: 42 },
		});
	});
});

describe('resolveTarget — agent-block-id (post-content)', () => {
	it('detects blockType from the first wp-block-* class', () => {
		const el = make('h2', { 'data-extendify-agent-block-id': '7' }, [
			'wp-block-heading',
		]);
		document.body.appendChild(el);
		const result = resolveTarget(el);
		expect(result).toMatchObject({
			blockId: 7,
			blockType: 'core/heading',
		});
		expect(result.el).toBe(el);
	});

	it('resolves wp-block-paragraph to core/paragraph (no special-case needed)', () => {
		const el = make('p', { 'data-extendify-agent-block-id': '7' }, [
			'wp-block-paragraph',
		]);
		document.body.appendChild(el);
		expect(resolveTarget(el)).toMatchObject({
			blockId: 7,
			blockType: 'core/paragraph',
		});
	});

	it.each([
		['wp-block-group', 'core/group'],
		['wp-block-columns', 'core/columns'],
		['wp-block-media-text', 'core/media-text'],
		['wp-block-gallery', 'core/gallery'],
		['wp-block-quote', 'core/quote'],
		['wp-block-list', 'core/list'],
		['wp-block-table', 'core/table'],
		['wp-block-buttons', 'core/buttons'],
	])('derives %s → %s for any tagged container', (cls, expected) => {
		const el = make('div', { 'data-extendify-agent-block-id': '9' }, [cls]);
		document.body.appendChild(el);
		expect(resolveTarget(el)).toMatchObject({
			blockId: 9,
			blockType: expected,
		});
	});

	it.each([
		'wp-block-acme-testimonial',
		'wp-block-jetpack-contact-form',
		'wp-block-woocommerce-product-price',
	])('returns blockType null for the third-party class %s instead of a fabricated core/* type', (cls) => {
		const el = make('div', { 'data-extendify-agent-block-id': '9' }, [cls]);
		document.body.appendChild(el);
		expect(resolveTarget(el).blockType).toBeNull();
	});

	it('keeps the tagged ancestor as el even when the hovered child has its own type', () => {
		const wrapper = make('div', { 'data-extendify-agent-block-id': '7' }, [
			'wp-block-group',
		]);
		const child = make('h2', {}, ['wp-block-heading']);
		wrapper.appendChild(child);
		document.body.appendChild(wrapper);

		// Selection lands on the tagged ancestor — the pill renderer decides
		// what to offer. (Recognition-based child preference was dropped in
		// the selector-unification refactor.)
		const result = resolveTarget(child);
		expect(result.el).toBe(wrapper);
		expect(result.blockType).toBe('core/group');
		expect(result.blockId).toBe(7);
	});

	it('returns blockType null when the tagged ancestor is in KNOWN_UNSUPPORTED', () => {
		const el = make('h1', { 'data-extendify-agent-block-id': '7' }, [
			'wp-block-post-title',
		]);
		document.body.appendChild(el);
		expect(resolveTarget(el).blockType).toBeNull();
	});

	it('reads source from window.extQuickEditData.context.currentSource', () => {
		window.extQuickEditData = {
			context: { currentSource: { kind: 'post', id: 42 } },
		};
		const el = make('p', { 'data-extendify-agent-block-id': '1' }, [
			'wp-block-paragraph',
		]);
		document.body.appendChild(el);
		expect(resolveTarget(el).source).toEqual({ kind: 'post', id: 42 });
	});

	it('defaults source to null when no currentSource is set', () => {
		const el = make('p', { 'data-extendify-agent-block-id': '1' }, [
			'wp-block-paragraph',
		]);
		document.body.appendChild(el);
		expect(resolveTarget(el).source).toBeNull();
	});
});

describe('resolveTarget — template part', () => {
	it('returns kind=template-part with the part slug and the ancestor blockType', () => {
		const part = make(
			'div',
			{
				'data-extendify-part-block-id': '3',
				'data-extendify-part-slug': 'header',
			},
			['wp-block-group'],
		);
		const child = make('p', {}, ['wp-block-paragraph']);
		part.appendChild(child);
		document.body.appendChild(part);

		const result = resolveTarget(child);
		expect(result).toMatchObject({
			blockId: 3,
			blockType: 'core/group',
			source: { kind: 'template-part', partSlug: 'header' },
		});
	});

	it('routes ref-based nav items through wp-navigation', () => {
		const nav = make('nav', { 'data-extendify-quick-edit-nav-ref': '12' });
		const item = make(
			'li',
			{
				'data-extendify-part-block-id': '5',
				'data-extendify-quick-edit-nav-item-index': '2',
			},
			['wp-block-navigation-item'],
		);
		nav.appendChild(item);
		document.body.appendChild(nav);

		expect(resolveTarget(item)).toEqual({
			el: item,
			blockType: 'core/navigation-link',
			navPostId: 12,
			itemIndex: 2,
			source: { kind: 'wp-navigation', id: 12, itemIndex: 2 },
		});
	});

	it('falls back to template-part for nav items without a nav-ref ancestor (inline nav)', () => {
		const part = make('header', { 'data-extendify-part-block-id': '7' });
		const item = make(
			'li',
			{
				'data-extendify-part-block-id': '5',
				'data-extendify-quick-edit-nav-item-index': '2',
			},
			['wp-block-navigation-item'],
		);
		part.appendChild(item);
		document.body.appendChild(part);

		const result = resolveTarget(item);
		expect(result.source.kind).toBe('template-part');
	});

	it('lands on the tagged template-part ancestor regardless of which child was hovered', () => {
		const buttons = make(
			'div',
			{
				'data-extendify-part-block-id': '4',
				'data-extendify-part-slug': 'header',
			},
			['wp-block-buttons'],
		);
		const button = make('div', {}, ['wp-block-button']);
		buttons.appendChild(button);
		document.body.appendChild(buttons);

		const result = resolveTarget(button);
		expect(result.el).toBe(buttons);
		expect(result.blockType).toBe('core/buttons');
		expect(result.blockId).toBe(4);
		expect(result.source).toEqual({
			kind: 'template-part',
			partSlug: 'header',
		});
	});
});

describe('splice — null safety', () => {
	it('returns null when liveEl is missing', () => {
		expect(splice(null, '<p>x</p>')).toBeNull();
	});

	it('returns null when renderedHtml is missing', () => {
		expect(splice(make('p'), '')).toBeNull();
	});
});

describe('splice — DOM swap', () => {
	it('replaces liveEl with the parsed first element of renderedHtml', () => {
		const parent = document.createElement('div');
		const live = make('p', { 'data-x': '1' });
		live.textContent = 'old';
		parent.appendChild(live);
		document.body.appendChild(parent);

		const result = splice(live, '<p class="new">new</p>');
		expect(result).not.toBeNull();
		expect(parent.firstElementChild).toBe(result);
		expect(parent.firstElementChild.textContent).toBe('new');
		expect(parent.firstElementChild.classList.contains('new')).toBe(true);
	});

	it('carries forward data-extendify-* attributes from the live element', () => {
		const parent = document.createElement('div');
		const live = make('p', {
			'data-extendify-agent-block-id': '7',
			'data-extendify-part-block-id': '3',
			'data-x': 'not-carried',
		});
		parent.appendChild(live);

		const result = splice(live, '<p>new</p>');
		expect(result.getAttribute('data-extendify-agent-block-id')).toBe('7');
		expect(result.getAttribute('data-extendify-part-block-id')).toBe('3');
		expect(result.getAttribute('data-x')).toBeNull();
	});

	// The save re-renders the block in an isolated scope, so the returned HTML
	// carries a fresh agent/post tag (data-extendify-agent-block-id) numbered
	// for that scope. A template-part block's live element has only the part
	// tag, so without dropping the stray agent tag the spliced node ends up
	// with BOTH — and resolveTarget (agent tag checked before part tag)
	// resolves the re-edit to the wrong (post) block (wrong content / empty toolbar).
	it('drops the re-render stray identity tags, keeping only the live element identity', () => {
		const parent = document.createElement('div');
		const live = make('div', {
			'data-extendify-part-block-id': '5',
			'data-extendify-part-slug': 'header',
		});
		parent.appendChild(live);

		const result = splice(
			live,
			'<div data-extendify-agent-block-id="1">new</div>',
		);
		expect(result.getAttribute('data-extendify-agent-block-id')).toBeNull();
		expect(result.getAttribute('data-extendify-part-block-id')).toBe('5');
		expect(result.getAttribute('data-extendify-part-slug')).toBe('header');
	});

	it('carries forward color / font-size / background attribute classes that lose round-trip', () => {
		const parent = document.createElement('div');
		const live = make('p', {}, [
			'has-text-color',
			'has-primary-color',
			'has-background',
			'has-large-font-size',
		]);
		parent.appendChild(live);

		const result = splice(live, '<p class="new">x</p>');
		for (const cls of [
			'has-text-color',
			'has-primary-color',
			'has-background',
			'has-large-font-size',
		]) {
			expect(result.classList.contains(cls)).toBe(true);
		}
	});

	it('strips ext-animate--on from the new node + descendants', () => {
		const parent = document.createElement('div');
		const live = make('p');
		parent.appendChild(live);

		const result = splice(
			live,
			'<div class="ext-animate--on"><span class="ext-animate--on">x</span></div>',
		);
		expect(result.classList.contains('ext-animate--on')).toBe(false);
		expect(result.querySelectorAll('.ext-animate--on').length).toBe(0);
	});

	it('returns null when renderedHtml has no element (whitespace-only)', () => {
		const parent = document.createElement('div');
		const live = make('p');
		parent.appendChild(live);
		expect(splice(live, '   ')).toBeNull();
	});

	it('carries the live element variation-instance class when the re-render omits it', () => {
		const parent = document.createElement('div');
		const live = make('div', {}, [
			'wp-block-button',
			'is-style-ext-preset--button--soft-1--button-1',
			'is-style-ext-preset--button--soft-1--button-1--3',
		]);
		parent.appendChild(live);

		const result = splice(
			live,
			'<div class="wp-block-button is-style-ext-preset--button--soft-1--button-1"><a class="wp-block-button__link">x</a></div>',
		);
		expect(
			result.classList.contains(
				'is-style-ext-preset--button--soft-1--button-1--3',
			),
		).toBe(true);
	});

	it('lets patchVariantClasses win when the re-render already carries an instance class', () => {
		const parent = document.createElement('div');
		const live = make('div', {}, [
			'wp-block-button',
			'is-style-ext-preset--button--soft-1--button-1',
			'is-style-ext-preset--button--soft-1--button-1--3',
		]);
		parent.appendChild(live);

		const result = splice(
			live,
			'<div class="wp-block-button is-style-ext-preset--button--soft-1--button-1 is-style-ext-preset--button--soft-1--button-1--7"><a class="wp-block-button__link">x</a></div>',
		);
		expect(
			result.classList.contains(
				'is-style-ext-preset--button--soft-1--button-1--3',
			),
		).toBe(true);
		expect(
			result.classList.contains(
				'is-style-ext-preset--button--soft-1--button-1--7',
			),
		).toBe(false);
	});
});
