<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\Button;
use WP_UnitTestCase;

class ButtonTest extends WP_UnitTestCase
{
    public function test_fields_returns_text_then_url()
    {
        $fields = (new Button())->fields();

        $this->assertCount(2, $fields);
        $this->assertSame('text', $fields[0]['key']);
        $this->assertSame('text', $fields[0]['control']);
        $this->assertSame('url',  $fields[1]['key']);
        $this->assertSame('link', $fields[1]['control']);
    }

    public function test_apply_text_replaces_anchor_text_preserving_anchor_attrs()
    {
        $html = '<div class="wp-block-button"><a class="wp-block-button__link" href="/about" target="_blank">Old label</a></div>';
        $block = $this->buttonBlock($html);

        $result = (new Button())->apply($block, 'text', 'New label');

        $this->assertStringContainsString('>New label<', $result['innerHTML']);
        $this->assertStringContainsString('href="/about"', $result['innerHTML']);
        $this->assertStringContainsString('target="_blank"', $result['innerHTML']);
    }

    public function test_apply_text_treats_regex_backreferences_in_user_text_as_literal()
    {
        $inputs = ['Try $1 for size', 'Use \\1 here', '$0 free', 'Mixed $1 and \\2'];
        $html   = '<div class="wp-block-button"><a class="wp-block-button__link" href="/about">old</a></div>';

        foreach ($inputs as $input) {
            $result = (new Button())->apply($this->buttonBlock($html), 'text', $input);

            $this->assertStringContainsString('>' . $input . '<', $result['innerHTML'], "input: {$input}");
            $this->assertStringContainsString('href="/about"', $result['innerHTML']);
        }
    }

    public function test_apply_url_sets_anchor_href()
    {
        $html = '<div class="wp-block-button"><a class="wp-block-button__link" href="/old">x</a></div>';
        $block = $this->buttonBlock($html);

        $result = (new Button())->apply($block, 'url', 'https://example.test/new');

        $this->assertStringContainsString('href="https://example.test/new"', $result['innerHTML']);
        $this->assertStringNotContainsString('href="/old"', $result['innerHTML']);
    }

    public function test_apply_url_strips_dangerous_schemes()
    {
        $html = '<div class="wp-block-button"><a class="wp-block-button__link" href="/old">x</a></div>';

        foreach (['javascript:alert(1)', 'jAvAsCrIpt:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox(1)'] as $url) {
            $result = (new Button())->apply($this->buttonBlock($html), 'url', $url);

            // esc_url_raw rejects the scheme entirely, so the href is dropped.
            $this->assertStringNotContainsString('href=', $result['innerHTML'], "url: {$url}");
            $this->assertStringNotContainsString('javascript', strtolower($result['innerHTML']), "url: {$url}");
        }
    }

    public function test_apply_text_runs_through_wp_kses_post()
    {
        $html  = '<div class="wp-block-button"><a class="wp-block-button__link" href="/x">old</a></div>';
        $result = (new Button())->apply($this->buttonBlock($html), 'text', 'hi<script>alert(1)</script>');

        $this->assertStringContainsString('hi', $result['innerHTML']);
        $this->assertStringNotContainsString('<script', $result['innerHTML']);
    }

    public function test_apply_url_empty_string_removes_href()
    {
        $html = '<div class="wp-block-button"><a class="wp-block-button__link" href="/old">x</a></div>';
        $block = $this->buttonBlock($html);

        $result = (new Button())->apply($block, 'url', '');

        $this->assertStringNotContainsString('href=', $result['innerHTML']);
    }

    public function test_apply_url_does_not_mutate_attrs()
    {
        $html = '<div class="wp-block-button"><a href="/x">y</a></div>';
        $block = $this->buttonBlock($html);

        $result = (new Button())->apply($block, 'url', 'https://example.test');

        // The button's canonical link target is the inner <a href>, not a block attribute.
        $this->assertSame($block['attrs'], $result['attrs']);
    }

    public function test_apply_with_unknown_field_returns_block_unchanged()
    {
        $block = $this->buttonBlock('<div><a href="/x">y</a></div>');

        $this->assertSame($block, (new Button())->apply($block, 'bogus', 'z'));
    }

    private function buttonBlock(string $innerHTML): array
    {
        return [
            'blockName'    => 'core/button',
            'attrs'        => [],
            'innerBlocks'  => [],
            'innerHTML'    => $innerHTML,
            'innerContent' => [$innerHTML],
        ];
    }
}
