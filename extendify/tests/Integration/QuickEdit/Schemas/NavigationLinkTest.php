<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\NavigationLink;
use WP_UnitTestCase;

class NavigationLinkTest extends WP_UnitTestCase
{
    public function test_fields_returns_label_then_url()
    {
        $fields = (new NavigationLink())->fields();

        $this->assertCount(2, $fields);
        $this->assertSame('label', $fields[0]['key']);
        $this->assertSame('text',  $fields[0]['control']);
        $this->assertSame('url',   $fields[1]['key']);
        $this->assertSame('link',  $fields[1]['control']);
    }

    public function test_apply_label_strips_tags_and_sets_attr()
    {
        $block = $this->navLinkBlock(['label' => 'old']);

        $result = (new NavigationLink())->apply($block, 'label', '  <b>About</b> us  ');

        $this->assertSame('About us', $result['attrs']['label']);
    }

    public function test_apply_label_with_non_string_becomes_empty()
    {
        $block = $this->navLinkBlock(['label' => 'old']);

        $result = (new NavigationLink())->apply($block, 'label', null);

        $this->assertSame('', $result['attrs']['label']);
    }

    public function test_apply_url_sets_attr()
    {
        $block = $this->navLinkBlock([]);

        $result = (new NavigationLink())->apply($block, 'url', 'https://example.test/about');

        $this->assertSame('https://example.test/about', $result['attrs']['url']);
    }

    public function test_apply_url_strips_dangerous_schemes()
    {
        foreach (['javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox(1)'] as $url) {
            $block  = $this->navLinkBlock([]);
            // esc_url_raw rejects the scheme → empty → attr left unset.
            $result = (new NavigationLink())->apply($block, 'url', $url);

            $this->assertArrayNotHasKey('url', $result['attrs'], "url: {$url}");
        }
    }

    public function test_apply_label_strips_script_tags()
    {
        $block  = $this->navLinkBlock([]);
        $result = (new NavigationLink())->apply($block, 'label', 'Home<script>alert(1)</script>');

        $this->assertSame('Home', $result['attrs']['label']);
    }

    public function test_apply_url_empty_string_unsets_attr()
    {
        $block = $this->navLinkBlock(['url' => 'https://example.test/old']);

        $result = (new NavigationLink())->apply($block, 'url', '');

        $this->assertArrayNotHasKey('url', $result['attrs']);
    }

    public function test_apply_with_unknown_field_returns_block_unchanged()
    {
        $block = $this->navLinkBlock(['label' => 'About']);

        $this->assertSame($block, (new NavigationLink())->apply($block, 'kind', 'post'));
    }

    private function navLinkBlock(array $attrs): array
    {
        return [
            'blockName'    => 'core/navigation-link',
            'attrs'        => $attrs,
            'innerBlocks'  => [],
            'innerHTML'    => '',
            'innerContent' => [],
        ];
    }
}
