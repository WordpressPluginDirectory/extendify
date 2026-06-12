// rich-text-color drives the text-color + highlight buttons inside the
// inline editor. Tests pin three contracts:
//   1. RICHTEXT_ATTR_BY_BLOCK map (the block-name → attr-key contract
//      that BlockTextEditor's content patch reads).
//   2. captureDomRichTextSelection's DOM walk (clientId + char offsets
//      from a window.getSelection range).
//   3. applyColorFormat's inline-style merge — including the non-obvious
//      `background-color: transparent` override that suppresses the
//      <mark> default yellow when only text color is set.

jest.mock('@wordpress/rich-text', () => {
	const create = jest.fn(({ html }) => ({
		text: html.replace(/<[^>]+>/g, ''),
		formats: [],
		replacements: [],
	}));
	const applyFormat = jest.fn((value, format) => ({
		...value,
		appliedFormat: format,
	}));
	const removeFormat = jest.fn((value, type) => ({
		...value,
		removedFormatType: type,
	}));
	const toHTMLString = jest.fn(({ value }) =>
		value.appliedFormat
			? `<mark style="${value.appliedFormat.attributes.style}">${value.text}</mark>`
			: value.text,
	);
	return { create, applyFormat, removeFormat, toHTMLString };
});

jest.mock('@wordpress/data', () => {
	const blocks = new Map();
	const select = jest.fn(() => ({
		getBlock: (clientId) => blocks.get(clientId),
		getSelectedBlockClientId: () => null,
		getBlockOrder: () => Array.from(blocks.keys()),
	}));
	return { select, __setBlock: (id, block) => blocks.set(id, block) };
});

let rtc;

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	document.body.innerHTML = '';
	rtc = require('@quick-edit/lib/rich-text-color');
});

describe('RICHTEXT_ATTR_BY_BLOCK', () => {
	it('maps each text-bearing block to its RichText attribute key', () => {
		expect(rtc.RICHTEXT_ATTR_BY_BLOCK).toEqual({
			'core/paragraph': 'content',
			'core/heading': 'content',
			'core/verse': 'content',
			'core/button': 'text',
			'core/pullquote': 'value',
			'core/code': 'content',
			'core/preformatted': 'content',
		});
	});
});

describe('captureDomRichTextSelection — null cases', () => {
	it('returns null when there is no selection', () => {
		const sel = jest.spyOn(window, 'getSelection').mockReturnValue(null);
		expect(rtc.captureDomRichTextSelection()).toBeNull();
		sel.mockRestore();
	});

	it('returns null when the range is outside a [contenteditable=true]', () => {
		const block = document.createElement('div');
		block.dataset.block = 'block-1';
		const span = document.createElement('span');
		span.textContent = 'plain';
		block.appendChild(span);
		document.body.appendChild(block);

		const range = document.createRange();
		range.setStart(span.firstChild, 0);
		range.setEnd(span.firstChild, 5);
		const sel = jest.spyOn(window, 'getSelection').mockReturnValue({
			rangeCount: 1,
			getRangeAt: () => range,
		});
		expect(rtc.captureDomRichTextSelection()).toBeNull();
		sel.mockRestore();
	});

	it('returns null when the contenteditable has no [data-block] ancestor', () => {
		const editable = document.createElement('div');
		editable.setAttribute('contenteditable', 'true');
		editable.textContent = 'hello world';
		document.body.appendChild(editable);

		const range = document.createRange();
		range.setStart(editable.firstChild, 0);
		range.setEnd(editable.firstChild, 5);
		const sel = jest.spyOn(window, 'getSelection').mockReturnValue({
			rangeCount: 1,
			getRangeAt: () => range,
		});
		expect(rtc.captureDomRichTextSelection()).toBeNull();
		sel.mockRestore();
	});
});

describe('captureDomRichTextSelection — happy path', () => {
	it('returns clientId + char offsets relative to the contenteditable', () => {
		const block = document.createElement('div');
		block.dataset.block = 'block-1';
		const editable = document.createElement('p');
		editable.setAttribute('contenteditable', 'true');
		editable.textContent = 'hello world';
		block.appendChild(editable);
		document.body.appendChild(block);

		const range = document.createRange();
		range.setStart(editable.firstChild, 0);
		range.setEnd(editable.firstChild, 5);
		const sel = jest.spyOn(window, 'getSelection').mockReturnValue({
			rangeCount: 1,
			getRangeAt: () => range,
		});

		expect(rtc.captureDomRichTextSelection()).toEqual({
			clientId: 'block-1',
			startOffset: 0,
			endOffset: 5,
		});
		sel.mockRestore();
	});
});

describe('applyColorFormat — selection resolution', () => {
	it('does nothing when there is no selection snapshot', () => {
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(null, 'text', '#f00', dispatch);
		expect(dispatch.updateBlockAttributes).not.toHaveBeenCalled();
	});

	it('does nothing when the snapshot has no usable range', () => {
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat({ sel: {} }, 'text', '#f00', dispatch);
		expect(dispatch.updateBlockAttributes).not.toHaveBeenCalled();
	});

	it('does nothing when the snap has no range AND no block can be resolved from the editor', () => {
		// snap.sel has no usable start.attributeKey + no snap.dom range. The
		// fallback then tries the block-editor data store, which our mock
		// returns no blocks for. resolveSelectionFromSnap returns null.
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(
			{ sel: { start: {}, end: {} } },
			'text',
			'#f00',
			dispatch,
		);
		expect(dispatch.updateBlockAttributes).not.toHaveBeenCalled();
	});

	it('falls through to whole-block on a collapsed selection when start/end share a clientId+attrKey', () => {
		// Pinning the (somewhat surprising) characterization: a collapsed
		// selection is NOT a no-op — it falls through to the whole-block
		// branch and applies the format across the entire RichText content.
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(
			{
				sel: {
					start: { clientId: 'b-1', attributeKey: 'content', offset: 3 },
					end: { clientId: 'b-1', attributeKey: 'content', offset: 3 },
					block: {
						name: 'core/paragraph',
						attributes: { content: 'hello world' },
					},
				},
			},
			'text',
			'#f00',
			dispatch,
		);
		expect(dispatch.updateBlockAttributes).toHaveBeenCalledWith('b-1', {
			content: expect.any(String),
		});
	});
});

describe('applyColorFormat — write path', () => {
	const makeSnap = (block = {}) => ({
		sel: {
			start: { clientId: 'b-1', attributeKey: 'content', offset: 0 },
			end: { clientId: 'b-1', attributeKey: 'content', offset: 5 },
			block: {
				name: 'core/paragraph',
				attributes: { content: 'hello world' },
				...block,
			},
		},
	});

	it('writes a text-color format with the requested color and updates the block attribute', () => {
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(makeSnap(), 'text', '#f00', dispatch);

		const rt = require('@wordpress/rich-text');
		const [_value, format] = rt.applyFormat.mock.calls[0];
		expect(format.type).toBe('core/text-color');
		// The non-obvious bit: setting only text color forces background-color: transparent
		// so the wrapping <mark>'s default yellow doesn't show through.
		expect(format.attributes.style).toContain('color:#f00');
		expect(format.attributes.style).toContain('background-color:transparent');

		expect(dispatch.updateBlockAttributes).toHaveBeenCalledWith('b-1', {
			content: expect.any(String),
		});
	});

	it('writes background-color without forcing transparent fallback', () => {
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(makeSnap(), 'background', '#0f0', dispatch);

		const rt = require('@wordpress/rich-text');
		const [, format] = rt.applyFormat.mock.calls[0];
		expect(format.attributes.style).toBe('background-color:#0f0');
	});

	it('removes the text-color format when color is null', () => {
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(makeSnap(), 'text', null, dispatch);

		const rt = require('@wordpress/rich-text');
		expect(rt.removeFormat).toHaveBeenCalledWith(
			expect.anything(),
			'core/text-color',
			0,
			5,
		);
	});

	it('schedules a selectionChange via requestAnimationFrame', () => {
		const rafSpy = jest
			.spyOn(window, 'requestAnimationFrame')
			.mockImplementation((cb) => cb());

		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(makeSnap(), 'text', '#f00', dispatch);

		expect(dispatch.selectionChange).toHaveBeenCalledWith(
			'b-1',
			'content',
			0,
			5,
		);
		rafSpy.mockRestore();
	});

	it('clamps the selection offsets to the actual text length', () => {
		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		// snap requests 0–500 but the text is only 11 chars
		rtc.applyColorFormat(
			{
				sel: {
					start: { clientId: 'b-1', attributeKey: 'content', offset: 0 },
					end: { clientId: 'b-1', attributeKey: 'content', offset: 500 },
					block: {
						name: 'core/paragraph',
						attributes: { content: 'hello world' },
					},
				},
			},
			'text',
			'#f00',
			dispatch,
		);

		const rt = require('@wordpress/rich-text');
		const [, , startOffset, endOffset] = rt.applyFormat.mock.calls[0];
		expect(startOffset).toBe(0);
		expect(endOffset).toBe(11);
	});
});

describe('applyColorFormat — per-segment preserves the other property', () => {
	const RED_BG = {
		type: 'core/text-color',
		attributes: { style: 'background-color:#cf2e2e' },
	};
	const RED_TEXT = {
		type: 'core/text-color',
		attributes: { style: 'color:#ff0000;background-color:transparent' },
	};

	const formatsWith = (text, fmt, from, to) =>
		text.split('').map((_, i) => (i >= from && i < to ? [fmt] : undefined));

	const snapForRange = (text, formats, from, to) => ({
		sel: {
			start: { clientId: 'b-1', attributeKey: 'content', offset: from },
			end: { clientId: 'b-1', attributeKey: 'content', offset: to },
			block: {
				name: 'core/paragraph',
				attributes: { content: { text, formats, replacements: [] } },
			},
		},
	});

	const stylesFromApplyFormatCalls = () => {
		const rt = require('@wordpress/rich-text');
		return rt.applyFormat.mock.calls.map(([, format, from, to]) => ({
			from,
			to,
			style: format.attributes.style,
		}));
	};

	it('picking text color on a range with a sub-range bg preserves the bg only on its sub-range', () => {
		// Chris's repro: 'Here is some sample text', bg=red on 'some',
		// then pick text gray on 'is some sample'. Expected — three
		// segments, red preserved only on 'some'.
		const text = 'Here is some sample text';
		const formats = formatsWith(text, RED_BG, 8, 12);

		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(
			snapForRange(text, formats, 5, 19),
			'text',
			'#abb8c3',
			dispatch,
		);

		const segs = stylesFromApplyFormatCalls();
		expect(segs).toHaveLength(3);
		expect(segs[0]).toEqual({
			from: 5,
			to: 8,
			style: 'color:#abb8c3;background-color:transparent',
		});
		expect(segs[1]).toEqual({
			from: 8,
			to: 12,
			style: 'color:#abb8c3;background-color:#cf2e2e',
		});
		expect(segs[2]).toEqual({
			from: 12,
			to: 19,
			style: 'color:#abb8c3;background-color:transparent',
		});
	});

	it('picking highlight on a range with a sub-range text color preserves the text color only on its sub-range', () => {
		// Mirror direction: bg=yellow on the whole range, but only the
		// sub-range carries `color:#ff0000`. Picking highlight=yellow
		// should leave the red text color intact only on its sub-range.
		const text = 'Here is some sample text';
		const formats = formatsWith(text, RED_TEXT, 8, 12);

		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(
			snapForRange(text, formats, 5, 19),
			'highlight',
			'#ffff00',
			dispatch,
		);

		const segs = stylesFromApplyFormatCalls();
		expect(segs).toHaveLength(3);
		expect(segs[0]).toEqual({
			from: 5,
			to: 8,
			style: 'background-color:#ffff00',
		});
		expect(segs[1]).toEqual({
			from: 8,
			to: 12,
			style: 'color:#ff0000;background-color:#ffff00',
		});
		expect(segs[2]).toEqual({
			from: 12,
			to: 19,
			style: 'background-color:#ffff00',
		});
	});

	it('picks across a uniform-bg range collapse to ONE segment carrying both props', () => {
		// Whole range has bg=yellow; pick text=red. One segment carrying
		// both. This is the case the prior uniformity-based fix happened
		// to handle correctly; the per-segment shape still produces it
		// because the runs collapse when the other prop is uniform.
		const yellow = {
			type: 'core/text-color',
			attributes: { style: 'background-color:#ffff00' },
		};
		const text = 'hello';
		const formats = formatsWith(text, yellow, 0, text.length);

		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(
			snapForRange(text, formats, 0, text.length),
			'text',
			'#ff0000',
			dispatch,
		);

		const segs = stylesFromApplyFormatCalls();
		expect(segs).toHaveLength(1);
		expect(segs[0].style).toContain('color:#ff0000');
		expect(segs[0].style).toContain('background-color:#ffff00');
	});

	it('picks on a plain range with no pre-existing formats writes ONE segment with the transparent override', () => {
		const text = 'hello';
		const formats = text.split('').map(() => undefined);

		const dispatch = {
			updateBlockAttributes: jest.fn(),
			selectionChange: jest.fn(),
		};
		rtc.applyColorFormat(
			snapForRange(text, formats, 0, text.length),
			'text',
			'#ff0000',
			dispatch,
		);

		const segs = stylesFromApplyFormatCalls();
		expect(segs).toHaveLength(1);
		expect(segs[0].style).toBe('color:#ff0000;background-color:transparent');
	});
});
