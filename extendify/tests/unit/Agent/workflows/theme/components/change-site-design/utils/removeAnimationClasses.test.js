import { removeAnimationClasses } from '@agent/workflows/theme/components/change-site-design/utils/removeAnimationClasses';

describe('removeAnimationClasses', () => {
	it('returns null for null input', () => {
		expect(removeAnimationClasses(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(removeAnimationClasses(undefined)).toBeNull();
	});

	it('does not mutate the original element', () => {
		const el = document.createElement('div');
		el.className = 'ext-animate ext-animate--on';

		removeAnimationClasses(el);

		expect(el.classList.contains('ext-animate')).toBe(true);
		expect(el.classList.contains('ext-animate--on')).toBe(true);
	});

	it('removes animation classes from the root element', () => {
		const el = document.createElement('div');
		el.className = 'ext-animate ext-animate--on some-other-class';

		const result = removeAnimationClasses(el);

		expect(result.classList.contains('ext-animate')).toBe(false);
		expect(result.classList.contains('ext-animate--on')).toBe(false);
		expect(result.classList.contains('some-other-class')).toBe(true);
	});

	it('removes animation classes from descendant elements', () => {
		const el = document.createElement('div');
		el.innerHTML = `
			<p class="ext-animate">First</p>
			<p class="ext-animate--on">Second</p>
			<p class="ext-animate ext-animate--on other-class">Third</p>
		`;

		const result = removeAnimationClasses(el);
		const paragraphs = result.querySelectorAll('p');

		expect(paragraphs[0].classList.contains('ext-animate')).toBe(false);
		expect(paragraphs[1].classList.contains('ext-animate--on')).toBe(false);
		expect(paragraphs[2].classList.contains('ext-animate')).toBe(false);
		expect(paragraphs[2].classList.contains('ext-animate--on')).toBe(false);
		expect(paragraphs[2].classList.contains('other-class')).toBe(true);
	});

	it('returns the element unchanged when no animation classes are present', () => {
		const el = document.createElement('div');
		el.className = 'some-class another-class';

		const result = removeAnimationClasses(el);

		expect(result.className).toBe('some-class another-class');
	});
});
