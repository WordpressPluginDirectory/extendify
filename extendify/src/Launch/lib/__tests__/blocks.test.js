import { removeBlocks, addIdAttributeToBlock } from '@launch/lib/blocks';

describe('removeBlocks', () => {
	const sampleBlocks = [
		{ name: 'core/paragraph', innerBlocks: [] },
		{
			name: 'core/group',
			innerBlocks: [
				{ name: 'core/image', innerBlocks: [] },
				{ name: 'core/button', innerBlocks: [] },
			],
		},
		{ name: 'core/html', innerBlocks: [] },
	];

	it('removes top-level blocks by name', () => {
		const result = removeBlocks(sampleBlocks, ['core/html']);
		expect(result.some((b) => b.name === 'core/html')).toBe(false);
	});

	it('removes nested blocks by name', () => {
		const result = removeBlocks(sampleBlocks, ['core/image']);
		const group = result.find((b) => b.name === 'core/group');
		expect(group.innerBlocks.some((b) => b.name === 'core/image')).toBe(false);
	});

	it('keeps structure of remaining blocks', () => {
		const result = removeBlocks(sampleBlocks, ['core/html']);
		const group = result.find((b) => b.name === 'core/group');
		expect(Array.isArray(group.innerBlocks)).toBe(true);
	});
});

describe('addIdAttributeToBlock', () => {
	const blockCode = '<div class="wp-block-group something">Content</div>';

	it('adds id attribute to block with wp-block-group class', () => {
		const result = addIdAttributeToBlock(blockCode, 'test-id');
		expect(result).toContain('id="test-id"');
	});

	it('does not break other parts of the HTML', () => {
		const result = addIdAttributeToBlock(blockCode, 'unique-id');
		expect(result).toContain(
			'<div class="wp-block-group something" id="unique-id">',
		);
	});

	it('does nothing if blockCode doesn’t match the expected pattern', () => {
		const input = '<div class="something-else">Hello</div>';
		const result = addIdAttributeToBlock(input, 'abc');
		expect(result).toBe(input);
	});
});
