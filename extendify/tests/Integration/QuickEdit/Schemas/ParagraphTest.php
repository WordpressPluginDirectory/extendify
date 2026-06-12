<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\Paragraph;
use WP_UnitTestCase;

class ParagraphTest extends WP_UnitTestCase
{
    public function test_fields_returns_text_then_alignment()
    {
        $fields = (new Paragraph())->fields();

        $this->assertCount(2, $fields);

        $this->assertSame('content', $fields[0]['key']);
        $this->assertSame('text',    $fields[0]['control']);

        $this->assertSame('align',     $fields[1]['key']);
        $this->assertSame('alignment', $fields[1]['control']);

        $alignValues = array_column($fields[1]['options'], 'value');
        $this->assertSame(['left', 'center', 'right'], $alignValues);
    }

    public function test_apply_content_rewrites_inner_p_preserving_p_attributes()
    {
        $block = $this->paragraphBlock('<p class="has-large-font-size">old</p>');

        $result = (new Paragraph())->apply($block, 'content', 'new');

        $this->assertSame('<p class="has-large-font-size">new</p>', $result['innerHTML']);
        $this->assertSame([$result['innerHTML']], $result['innerContent']);
    }

    public function test_apply_content_synthesizes_p_when_none_exists()
    {
        $block = $this->paragraphBlock('');

        $result = (new Paragraph())->apply($block, 'content', 'hello');

        $this->assertSame('<p>hello</p>', $result['innerHTML']);
        $this->assertSame(['<p>hello</p>'], $result['innerContent']);
    }

    public function test_apply_content_runs_through_wp_kses_post()
    {
        $block = $this->paragraphBlock('<p>old</p>');

        $result = (new Paragraph())->apply($block, 'content', 'safe <script>bad()</script>');

        // wp_kses_post strips <script>; bare text + tag name leak through but the call is unsafe-script-free.
        $this->assertStringNotContainsString('<script>', $result['innerHTML']);
    }

    public function test_apply_content_treats_regex_backreferences_in_user_text_as_literal()
    {
        $inputs = ['Try $1 for size', 'Use \\1 here', '$0 free', 'Mixed $1 and \\2'];

        foreach ($inputs as $input) {
            $block  = $this->paragraphBlock('<p>old</p>');
            $result = (new Paragraph())->apply($block, 'content', $input);

            $this->assertSame('<p>' . $input . '</p>', $result['innerHTML'], "input: {$input}");
        }
    }

    public function test_apply_align_sets_attr_and_adds_alignment_class()
    {
        $block = $this->paragraphBlock('<p>x</p>');

        $result = (new Paragraph())->apply($block, 'align', 'center');

        $this->assertSame('center', $result['attrs']['align']);
        $this->assertStringContainsString('has-text-align-center', $result['innerHTML']);
    }

    public function test_apply_align_with_invalid_value_removes_alignment()
    {
        $block = $this->paragraphBlock('<p class="has-text-align-right">x</p>');
        $block['attrs']['align'] = 'right';

        $result = (new Paragraph())->apply($block, 'align', 'sideways');

        $this->assertArrayNotHasKey('align', $result['attrs']);
        $this->assertStringNotContainsString('has-text-align-', $result['innerHTML']);
    }

    public function test_apply_align_replaces_existing_alignment_class()
    {
        $block = $this->paragraphBlock('<p class="has-text-align-left other">x</p>');

        $result = (new Paragraph())->apply($block, 'align', 'right');

        $this->assertStringContainsString('has-text-align-right', $result['innerHTML']);
        $this->assertStringNotContainsString('has-text-align-left', $result['innerHTML']);
        $this->assertStringContainsString('other', $result['innerHTML']);
    }

    public function test_apply_with_unknown_field_returns_block_unchanged()
    {
        $block = $this->paragraphBlock('<p>x</p>');

        $this->assertSame($block, (new Paragraph())->apply($block, 'bogus', 'y'));
    }

    private function paragraphBlock(string $innerHTML): array
    {
        return [
            'blockName'    => 'core/paragraph',
            'attrs'        => [],
            'innerBlocks'  => [],
            'innerHTML'    => $innerHTML,
            'innerContent' => [$innerHTML],
        ];
    }
}
