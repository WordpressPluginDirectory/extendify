import {
	applyVariantNumberMapToHtml,
	esc,
	getVariantClassInfo,
	getVariantClassInfoFromHtml,
	getVariantNumbersInHtml,
	getVariantNumbersInTree,
	patchVariantClasses,
} from '../variant-classes';

describe('variant-classes regex patterns', () => {
	describe('esc', () => {
		it('escapes special regex characters', () => {
			expect(esc('is-style-outline')).toBe('is-style-outline');
			expect(esc('test.class')).toBe('test\\.class');
			expect(esc('test[0]')).toBe('test\\[0\\]');
		});
	});

	describe('getVariantNumbersInTree', () => {
		describe('is-style-outline pattern (simple)', () => {
			it('extracts number from is-style-outline--N', () => {
				const el = document.createElement('div');
				el.className = 'wp-block-button is-style-outline is-style-outline--3';

				const result = getVariantNumbersInTree(el, 'is-style-outline');
				expect(result).toEqual([3]);
			});

			it('extracts multiple numbers from nested elements', () => {
				const el = document.createElement('div');
				el.innerHTML = `
					<div class="is-style-outline--1"></div>
					<div class="is-style-outline--2"></div>
				`;

				const result = getVariantNumbersInTree(el, 'is-style-outline');
				expect(result).toEqual([1, 2]);
			});

			it('returns empty array when no matches', () => {
				const el = document.createElement('div');
				el.className = 'wp-block-button is-style-outline';

				const result = getVariantNumbersInTree(el, 'is-style-outline');
				expect(result).toEqual([]);
			});

			it('deduplicates numbers', () => {
				const el = document.createElement('div');
				el.innerHTML = `
					<div class="is-style-outline--1"></div>
					<div class="is-style-outline--1"></div>
				`;

				const result = getVariantNumbersInTree(el, 'is-style-outline');
				expect(result).toEqual([1]);
			});

			it('does not match classes without trailing number', () => {
				const el = document.createElement('div');
				el.className = 'is-style-outline is-style-outline-foo';

				const result = getVariantNumbersInTree(el, 'is-style-outline');
				expect(result).toEqual([]);
			});
		});

		describe('is-style-ext-preset pattern (complex)', () => {
			it('extracts number from complex class ending with --N', () => {
				const el = document.createElement('div');
				el.className =
					'is-style-ext-preset--image--natural-1--image-1--content-bottom--13';

				const result = getVariantNumbersInTree(el, 'is-style-ext-preset');
				expect(result).toEqual([13]);
			});

			it('extracts multiple numbers from different elements', () => {
				const el = document.createElement('div');
				el.innerHTML = `
					<figure class="is-style-ext-preset--image--natural-1--image-1--content-bottom--12"></figure>
					<figure class="is-style-ext-preset--image--natural-1--image-1--content-bottom--13"></figure>
				`;

				const result = getVariantNumbersInTree(el, 'is-style-ext-preset');
				expect(result).toEqual([12, 13]);
			});

			it('ignores classes without trailing --number', () => {
				const el = document.createElement('div');
				el.className = `
					is-style-ext-preset-image-natural-1-image-1--content-bottom
					is-style-ext-preset--image--natural-1--image-1--content-bottom
				`;

				const result = getVariantNumbersInTree(el, 'is-style-ext-preset');
				expect(result).toEqual([]);
			});

			it('only extracts trailing number, not numbers in middle', () => {
				const el = document.createElement('div');
				el.className =
					'is-style-ext-preset--image--natural-1--image-1--content-bottom--42';

				const result = getVariantNumbersInTree(el, 'is-style-ext-preset');
				expect(result).toEqual([42]);
			});
		});

		it('returns empty array for null element', () => {
			const result = getVariantNumbersInTree(null, 'is-style-outline');
			expect(result).toEqual([]);
		});
	});

	describe('getVariantNumbersInHtml', () => {
		it('extracts numbers from HTML string', () => {
			const html = '<div class="is-style-outline--5">Test</div>';

			const result = getVariantNumbersInHtml(html, 'is-style-outline');
			expect(result).toEqual([5]);
		});

		it('handles complex ext-preset patterns', () => {
			const html =
				'<figure class="is-style-ext-preset--image--natural-1--image-1--content-bottom--1"></figure>';

			const result = getVariantNumbersInHtml(html, 'is-style-ext-preset');
			expect(result).toEqual([1]);
		});
	});

	describe('getVariantClassInfo', () => {
		it('extracts prefix and number pairs', () => {
			const el = document.createElement('div');
			el.innerHTML = `
				<figure class="is-style-ext-preset--image--natural--4"></figure>
				<div class="is-style-ext-preset--button--solid--5"></div>
			`;

			const result = getVariantClassInfo(el, 'is-style-ext-preset');

			expect(result).toEqual([
				{ prefix: 'is-style-ext-preset--image--natural', number: 4 },
				{ prefix: 'is-style-ext-preset--button--solid', number: 5 },
			]);
		});

		it('extracts prefix for simple patterns', () => {
			const el = document.createElement('div');
			el.innerHTML = `
				<div class="is-style-outline--3"></div>
				<div class="is-style-outline--7"></div>
			`;

			const result = getVariantClassInfo(el, 'is-style-outline');

			expect(result).toEqual([
				{ prefix: 'is-style-outline', number: 3 },
				{ prefix: 'is-style-outline', number: 7 },
			]);
		});

		it('deduplicates by number', () => {
			const el = document.createElement('div');
			el.innerHTML = `
				<div class="is-style-outline--3"></div>
				<div class="is-style-outline--3"></div>
			`;

			const result = getVariantClassInfo(el, 'is-style-outline');
			expect(result).toHaveLength(1);
			expect(result[0].number).toBe(3);
		});

		it('returns empty array for null element', () => {
			expect(getVariantClassInfo(null, 'is-style-outline')).toEqual([]);
		});

		it('returns empty array when no matches', () => {
			const el = document.createElement('div');
			el.className = 'wp-block-button';

			const result = getVariantClassInfo(el, 'is-style-outline');
			expect(result).toEqual([]);
		});
	});

	describe('getVariantClassInfoFromHtml', () => {
		it('extracts prefix and number pairs from HTML string', () => {
			const html = `
				<figure class="is-style-ext-preset--image--x--4"></figure>
				<div class="is-style-ext-preset--button--y--5"></div>
			`;

			const result = getVariantClassInfoFromHtml(html, 'is-style-ext-preset');

			expect(result).toEqual([
				{ prefix: 'is-style-ext-preset--image--x', number: 4 },
				{ prefix: 'is-style-ext-preset--button--y', number: 5 },
			]);
		});

		it('handles simple patterns', () => {
			const html = '<div class="is-style-outline--5">Test</div>';

			const result = getVariantClassInfoFromHtml(html, 'is-style-outline');

			expect(result).toEqual([{ prefix: 'is-style-outline', number: 5 }]);
		});
	});

	describe('applyVariantNumberMapToHtml', () => {
		describe('is-style-outline pattern', () => {
			it('applies number mapping to simple pattern', () => {
				const html =
					'<div class="wp-block-button is-style-outline is-style-outline--1">Test</div>';
				const map = new Map([[1, 5]]);

				const result = applyVariantNumberMapToHtml(
					html,
					'is-style-outline',
					map,
				);

				expect(result).toContain('is-style-outline--5');
				expect(result).not.toMatch(/is-style-outline--1[^\d]/);
			});

			it('applies multiple mappings', () => {
				const html = `
					<div class="is-style-outline--1"></div>
					<div class="is-style-outline--2"></div>
				`;
				const map = new Map([
					[1, 10],
					[2, 20],
				]);

				const result = applyVariantNumberMapToHtml(
					html,
					'is-style-outline',
					map,
				);

				expect(result).toContain('is-style-outline--10');
				expect(result).toContain('is-style-outline--20');
			});

			it('returns unchanged html if map is empty', () => {
				const html = '<div class="is-style-outline--1">Test</div>';
				const map = new Map();

				const result = applyVariantNumberMapToHtml(
					html,
					'is-style-outline',
					map,
				);

				expect(result).toContain('is-style-outline--1');
			});
		});

		describe('is-style-ext-preset pattern', () => {
			it('applies mapping to complex pattern', () => {
				const html =
					'<figure class="wp-block-image is-style-ext-preset--image--natural-1--image-1--content-bottom--1"></figure>';
				const map = new Map([[1, 12]]);

				const result = applyVariantNumberMapToHtml(
					html,
					'is-style-ext-preset',
					map,
				);

				expect(result).toContain(
					'is-style-ext-preset--image--natural-1--image-1--content-bottom--12',
				);
			});

			it('preserves middle numbers when changing trailing number', () => {
				const html =
					'<figure class="is-style-ext-preset--image--natural-1--image-1--content-bottom--2"></figure>';
				const map = new Map([[2, 13]]);

				const result = applyVariantNumberMapToHtml(
					html,
					'is-style-ext-preset',
					map,
				);

				expect(result).toContain('--natural-1--');
				expect(result).toContain('--image-1--');
				expect(result).toContain('content-bottom--13');
			});
		});
	});

	describe('patchVariantClasses', () => {
		describe('is-style-outline pattern', () => {
			it('patches HTML to match DOM variant numbers', () => {
				const html =
					'<div class="wp-block-button is-style-outline is-style-outline--1">Test</div>';
				const el = document.createElement('div');
				el.className = 'wp-block-button is-style-outline is-style-outline--5';

				const result = patchVariantClasses(html, el, ['is-style-outline']);

				expect(result).toContain('is-style-outline--5');
			});

			it('handles multiple variant numbers', () => {
				const html = `
					<div class="is-style-outline--1"></div>
					<div class="is-style-outline--2"></div>
				`;
				const el = document.createElement('div');
				el.innerHTML = `
					<div class="is-style-outline--10"></div>
					<div class="is-style-outline--20"></div>
				`;

				const result = patchVariantClasses(html, el, ['is-style-outline']);

				expect(result).toContain('is-style-outline--10');
				expect(result).toContain('is-style-outline--20');
			});

			it('returns unchanged HTML if no target numbers', () => {
				const html = '<div class="is-style-outline--1">Test</div>';
				const el = document.createElement('div');
				el.className = 'wp-block-button';

				const result = patchVariantClasses(html, el, ['is-style-outline']);

				expect(result).toContain('is-style-outline--1');
			});
		});

		describe('is-style-ext-preset pattern', () => {
			it('patches complex variant classes', () => {
				const html =
					'<figure class="wp-block-image is-style-ext-preset--image--natural-1--image-1--content-bottom--1"></figure>';
				const el = document.createElement('div');
				el.innerHTML =
					'<figure class="is-style-ext-preset--image--natural-1--image-1--content-bottom--12"></figure>';

				const result = patchVariantClasses(html, el, ['is-style-ext-preset']);

				expect(result).toContain('content-bottom--12');
			});

			it('handles multiple complex variants', () => {
				const html = `
					<figure class="is-style-ext-preset--a--1"></figure>
					<figure class="is-style-ext-preset--b--2"></figure>
				`;
				const el = document.createElement('div');
				el.innerHTML = `
					<figure class="is-style-ext-preset--a--12"></figure>
					<figure class="is-style-ext-preset--b--13"></figure>
				`;

				const result = patchVariantClasses(html, el, ['is-style-ext-preset']);

				expect(result).toContain('is-style-ext-preset--a--12');
				expect(result).toContain('is-style-ext-preset--b--13');
			});

			it('preserves non-variant classes', () => {
				const html = `<figure class="wp-block-image is-style-ext-preset-image-natural-1-image-1--content-bottom is-style-ext-preset--image--natural-1--image-1--content-bottom is-style-ext-preset--image--natural-1--image-1--content-bottom--1"></figure>`;
				const el = document.createElement('div');
				el.innerHTML = `<figure class="is-style-ext-preset--image--natural-1--image-1--content-bottom--13"></figure>`;

				const result = patchVariantClasses(html, el, ['is-style-ext-preset']);

				// Should preserve non-variant classes
				expect(result).toContain(
					'is-style-ext-preset-image-natural-1-image-1--content-bottom',
				);
				// Should patch the variant class
				expect(result).toContain('content-bottom--13');
			});
		});

		describe('multiple bases', () => {
			it('processes multiple base patterns', () => {
				const html = `
					<div class="is-style-outline--1"></div>
					<div class="is-style-ext-preset--a--2"></div>
				`;
				const el = document.createElement('div');
				el.innerHTML = `
					<div class="is-style-outline--10"></div>
					<div class="is-style-ext-preset--a--20"></div>
				`;

				const result = patchVariantClasses(html, el, [
					'is-style-outline',
					'is-style-ext-preset',
				]);

				expect(result).toContain('is-style-outline--10');
				expect(result).toContain('is-style-ext-preset--a--20');
			});
		});

		describe('element reordering (regression tests)', () => {
			it('matches by element type when elements are in different order than DOM', () => {
				// HTML has image first, button second
				const html = `
					<figure class="is-style-ext-preset--image--x--1"></figure>
					<div class="is-style-ext-preset--button--y--2"></div>
				`;
				// DOM has button first, image second (different order)
				const el = document.createElement('div');
				el.innerHTML = `
					<div class="is-style-ext-preset--button--y--10"></div>
					<figure class="is-style-ext-preset--image--x--11"></figure>
				`;

				const result = patchVariantClasses(html, el, ['is-style-ext-preset']);

				// Should match by prefix (element type), not by position
				expect(result).toContain('is-style-ext-preset--image--x--11');
				expect(result).toContain('is-style-ext-preset--button--y--10');
			});

			it('does not swap variant numbers when elements with same numbers are swapped', () => {
				// Original: image--4 left, button--5 right
				// After swap: button--5 left, image--4 right
				// The variant numbers should stay with their elements
				const html = `
					<div class="is-style-ext-preset--button--solid--1"></div>
					<figure class="is-style-ext-preset--image--natural--2"></figure>
				`;
				const el = document.createElement('div');
				el.innerHTML = `
					<figure class="is-style-ext-preset--image--natural--4"></figure>
					<div class="is-style-ext-preset--button--solid--5"></div>
				`;

				const result = patchVariantClasses(html, el, ['is-style-ext-preset']);

				// Button should get 5, image should get 4 (matched by type, not position)
				expect(result).toContain('is-style-ext-preset--button--solid--5');
				expect(result).toContain('is-style-ext-preset--image--natural--4');
			});

			it('handles multiple elements of the same type with position-based matching within type', () => {
				// Two images and one button
				const html = `
					<figure class="is-style-ext-preset--image--a--1"></figure>
					<figure class="is-style-ext-preset--image--a--2"></figure>
					<div class="is-style-ext-preset--button--b--3"></div>
				`;
				const el = document.createElement('div');
				el.innerHTML = `
					<figure class="is-style-ext-preset--image--a--10"></figure>
					<figure class="is-style-ext-preset--image--a--20"></figure>
					<div class="is-style-ext-preset--button--b--30"></div>
				`;

				const result = patchVariantClasses(html, el, ['is-style-ext-preset']);

				// Images should be matched by position within the image group
				expect(result).toContain('is-style-ext-preset--image--a--10');
				expect(result).toContain('is-style-ext-preset--image--a--20');
				// Button matched by its type
				expect(result).toContain('is-style-ext-preset--button--b--30');
			});
		});
	});
});
