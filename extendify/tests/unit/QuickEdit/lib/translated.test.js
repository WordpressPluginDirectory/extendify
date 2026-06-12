// The translated-content guard's pure helpers: which block types carry
// editable text (and so are blocked on a non-default-language render), the
// user-facing notice copy, and reading the server-detected context off the
// inline-script global.

import {
	getTranslatedContext,
	isTextBearing,
	isTranslatedRender,
	translatedNoticeMessage,
} from '@quick-edit/lib/translated';

describe('isTextBearing', () => {
	it('is true for the inline text blocks (the floating text toolbar)', () => {
		for (const blockType of ['core/paragraph', 'core/heading', 'core/button']) {
			expect(isTextBearing(blockType)).toBe(true);
		}
	});

	it('is true for the text-bearing modal blocks', () => {
		for (const blockType of [
			'core/site-title',
			'core/site-tagline',
			'core/navigation-link',
			'core/navigation-submenu',
			'product:name',
			'product:short_description',
			'product:description',
		]) {
			expect(isTextBearing(blockType)).toBe(true);
		}
	});

	it('is false for image / link / numeric edits that stay available', () => {
		for (const blockType of [
			'core/image',
			'core/cover',
			'core/media-text:image',
			'product:image',
			'core/site-logo',
			'core/social-link',
			'product:price',
			'wpforms:field',
		]) {
			expect(isTextBearing(blockType)).toBe(false);
		}
	});
});

describe('translatedNoticeMessage', () => {
	it('names the multilingual plugin when known', () => {
		expect(translatedNoticeMessage('translatepress')).toContain(
			'TranslatePress',
		);
		expect(translatedNoticeMessage('wpml')).toContain('WPML');
		expect(translatedNoticeMessage('polylang')).toContain('Polylang');
		expect(translatedNoticeMessage('translatepress')).toMatch(
			/can.t edit translated content/i,
		);
	});

	it('falls back to a generic message without a plugin name', () => {
		expect(translatedNoticeMessage(null)).toMatch(/translated content/i);
		expect(translatedNoticeMessage(undefined)).toMatch(/translated content/i);
	});
});

describe('translated context readers', () => {
	afterEach(() => {
		delete window.extQuickEditData;
	});

	it('reads translatedContext off the inline-script global', () => {
		window.extQuickEditData = {
			translatedContext: { isTranslated: true, plugin: 'wpml' },
		};
		expect(getTranslatedContext()).toEqual({
			isTranslated: true,
			plugin: 'wpml',
		});
		expect(isTranslatedRender()).toBe(true);
	});

	it('defaults to not-translated when the global is absent', () => {
		expect(getTranslatedContext()).toBeNull();
		expect(isTranslatedRender()).toBe(false);
	});
});
