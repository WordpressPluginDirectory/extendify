<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\Heading;
use WP_UnitTestCase;

class HeadingTest extends WP_UnitTestCase
{
    public function test_fields_returns_content_then_alignment_no_level()
    {
        $fields = (new Heading())->fields();

        $this->assertCount(2, $fields, 'level is intentionally not exposed (SEO/a11y)');
        $this->assertSame('content', $fields[0]['key']);
        $this->assertSame('align',   $fields[1]['key']);
    }

    public function test_apply_content_preserves_existing_heading_level()
    {
        $block = $this->headingBlock('<h3 class="x">old</h3>', ['level' => 3]);

        $result = (new Heading())->apply($block, 'content', 'new');

        $this->assertSame('<h3 class="x">new</h3>', $result['innerHTML']);
    }

    public function test_apply_content_synthesizes_h_tag_from_attrs_level_when_no_existing_tag()
    {
        $block = $this->headingBlock('', ['level' => 4]);

        $result = (new Heading())->apply($block, 'content', 'hi');

        $this->assertSame('<h4>hi</h4>', $result['innerHTML']);
    }

    public function test_apply_content_clamps_synthesized_level_to_1_6()
    {
        $block = $this->headingBlock('', ['level' => 99]);
        $this->assertSame('<h6>x</h6>', (new Heading())->apply($block, 'content', 'x')['innerHTML']);

        $block = $this->headingBlock('', ['level' => 0]);
        $this->assertSame('<h1>y</h1>', (new Heading())->apply($block, 'content', 'y')['innerHTML']);

        $block = $this->headingBlock('', []);
        $this->assertSame('<h2>z</h2>', (new Heading())->apply($block, 'content', 'z')['innerHTML'], 'defaults to h2');
    }

    public function test_apply_content_treats_regex_backreferences_in_user_text_as_literal()
    {
        $inputs = ['Try $1 for size', 'Use \\1 here', '$0 free', 'Mixed $1 and \\2'];

        foreach ($inputs as $input) {
            $block  = $this->headingBlock('<h2>old</h2>', ['level' => 2]);
            $result = (new Heading())->apply($block, 'content', $input);

            $this->assertSame('<h2>' . $input . '</h2>', $result['innerHTML'], "input: {$input}");
        }
    }

    public function test_apply_content_runs_through_wp_kses_post()
    {
        $block  = $this->headingBlock('<h2>old</h2>', ['level' => 2]);
        $result = (new Heading())->apply($block, 'content', 'hi<script>alert(1)</script>');

        $this->assertStringContainsString('hi', $result['innerHTML']);
        $this->assertStringNotContainsString('<script', $result['innerHTML']);
    }

    public function test_apply_align_uses_textAlign_attr_not_align()
    {
        $block = $this->headingBlock('<h2>x</h2>');

        $result = (new Heading())->apply($block, 'align', 'center');

        $this->assertSame('center', $result['attrs']['textAlign']);
        $this->assertArrayNotHasKey('align', $result['attrs']);
        $this->assertStringContainsString('has-text-align-center', $result['innerHTML']);
    }

    public function test_apply_align_with_invalid_value_clears_textAlign()
    {
        $block = $this->headingBlock('<h2 class="has-text-align-left">x</h2>', ['textAlign' => 'left']);

        $result = (new Heading())->apply($block, 'align', 'diagonal');

        $this->assertArrayNotHasKey('textAlign', $result['attrs']);
        $this->assertStringNotContainsString('has-text-align-', $result['innerHTML']);
    }

    public function test_apply_with_unknown_field_returns_block_unchanged()
    {
        $block = $this->headingBlock('<h2>x</h2>');

        $this->assertSame($block, (new Heading())->apply($block, 'level', 4));
    }

    private function headingBlock(string $innerHTML, array $attrs = []): array
    {
        return [
            'blockName'    => 'core/heading',
            'attrs'        => $attrs,
            'innerBlocks'  => [],
            'innerHTML'    => $innerHTML,
            'innerContent' => [$innerHTML],
        ];
    }
}
