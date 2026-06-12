// The content fingerprint is the client half of the same-type misresolve
// guard (SaveController / WPNavigationController). It carries the visible text
// of the block the user actually clicked so the server can refuse a save that
// resolved — by count — to a different block of the same type. normalizeText
// must mirror BlockFingerprint::normalize on the PHP side.

import {
	normalizedTextEquals,
	normalizeText,
	textFingerprint,
} from '@quick-edit/lib/fingerprint';

describe('normalizeText', () => {
	it('collapses whitespace runs to single spaces and trims', () => {
		expect(normalizeText('  hello   world \n')).toBe('hello world');
	});

	it('treats null/undefined as empty', () => {
		expect(normalizeText(null)).toBe('');
		expect(normalizeText(undefined)).toBe('');
	});

	// the_content runs wptexturize on the rendered DOM the client reads, so a
	// straight-quote source renders with smart quotes / dashes / ellipsis. Fold
	// them back so the fingerprint matches the raw markup the server parses.
	it('folds smart quotes, dashes, and ellipsis (wptexturize tolerance)', () => {
		expect(normalizeText('Woody’s')).toBe("Woody's");
		expect(normalizeText('‘a’')).toBe("'a'");
		expect(normalizeText('“quoted”')).toBe('"quoted"');
		expect(normalizeText('a—b')).toBe('a-b');
		expect(normalizeText('a–b')).toBe('a-b');
		expect(normalizeText('a--b')).toBe('a-b');
		expect(normalizeText('more…')).toBe('more...');
		expect(normalizeText('a b')).toBe('a b');
	});
});

describe('normalizedTextEquals', () => {
	// The reveal poll reads the editable (raw, straight quote) and the live
	// element (rendered, wptexturize'd curly quote); the two must compare equal
	// or a smart-quote block strands the reveal on its frame-cap.
	it('matches a raw block against its wptexturize-rendered twin', () => {
		expect(
			normalizedTextEquals(
				"Authentic falafel celebrating Chicago's vibrant food scene.",
				'Authentic falafel celebrating Chicago’s vibrant food scene.',
			),
		).toBe(true);
	});

	it('still matches across whitespace differences', () => {
		expect(normalizedTextEquals('  Shop   Desks ', 'Shop Desks')).toBe(true);
	});

	it('treats two empty/blank texts as equal (an empty block being edited)', () => {
		expect(normalizedTextEquals('', '   ')).toBe(true);
		expect(normalizedTextEquals(null, undefined)).toBe(true);
	});

	it('does not match genuinely different text', () => {
		expect(normalizedTextEquals('Welcome to WordPress', 'Shop Desks')).toBe(
			false,
		);
	});
});

describe('textFingerprint', () => {
	it('returns the normalized textContent of the element', () => {
		const el = document.createElement('p');
		el.textContent = '  Buy   now ';
		expect(textFingerprint(el)).toEqual({ text: 'Buy now' });
	});

	it('returns null when the element has no visible text (fail open)', () => {
		expect(textFingerprint(document.createElement('figure'))).toBeNull();
	});

	it('returns null for a missing element', () => {
		expect(textFingerprint(null)).toBeNull();
	});
});
