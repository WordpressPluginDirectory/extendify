import {
	addCustomMediaViewsCss,
	removeCustomMediaViewsCss,
} from '@shared/lib/media-views';

// media-views is a cross-bundle shared helper: the Agent (ImageUploader,
// UpdateImageConfirm) and QuickEdit (InlineEditor, SiteIdentityModal) both
// mount it on opening a wp.media picker and unmount it on cleanup. These pin
// the two guards both consumers lean on — a safe no-op when wp.media's
// stylesheet is absent, and a short-circuit when the override is already
// mounted. The CSS-rewrite injection itself walks the browser CSSOM
// (rule.style spread) which jsdom can't run, so that half is covered
// behaviorally by the image-flows Playwright spec, not here.
const STYLE_ID = 'media-views-important';
const SHEET_ID = 'media-views-css';

// Stand in for wp.media's own enqueued stylesheet.
const mountMediaViewsSheet = () => {
	const sheet = document.createElement('style');
	sheet.id = SHEET_ID;
	sheet.textContent = '.media-frame { color: red; }';
	document.head.appendChild(sheet);
};

describe('media-views shared helper', () => {
	afterEach(() => {
		document.getElementById(STYLE_ID)?.remove();
		document.getElementById(SHEET_ID)?.remove();
	});

	describe('addCustomMediaViewsCss', () => {
		it('is a safe no-op when wp.media stylesheet is absent', () => {
			expect(document.getElementById(SHEET_ID)).toBeNull();

			expect(() => addCustomMediaViewsCss()).not.toThrow();

			expect(document.getElementById(STYLE_ID)).toBeNull();
		});

		it('short-circuits when the override is already mounted', () => {
			// Both a real sheet and a prior override are present; the
			// id-guard must return before touching the sheet — otherwise the
			// CSSOM walk runs (and would re-inject a duplicate id).
			mountMediaViewsSheet();
			const existing = document.createElement('style');
			existing.id = STYLE_ID;
			document.head.appendChild(existing);

			addCustomMediaViewsCss();

			expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
			expect(document.getElementById(STYLE_ID)).toBe(existing);
		});
	});

	describe('removeCustomMediaViewsCss', () => {
		it('removes an injected style element', () => {
			const style = document.createElement('style');
			style.id = STYLE_ID;
			document.head.appendChild(style);

			removeCustomMediaViewsCss();

			expect(document.getElementById(STYLE_ID)).toBeNull();
		});

		it('is a safe no-op when nothing was injected', () => {
			expect(() => removeCustomMediaViewsCss()).not.toThrow();
			expect(document.getElementById(STYLE_ID)).toBeNull();
		});
	});
});
