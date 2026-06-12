<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\SocialLink;
use WP_UnitTestCase;

class SocialLinkTest extends WP_UnitTestCase
{
    public function test_fields_returns_single_url_field()
    {
        $fields = (new SocialLink())->fields();

        $this->assertCount(1, $fields);
        $this->assertSame('url',  $fields[0]['key']);
        $this->assertSame('link', $fields[0]['control']);
    }

    public function test_apply_url_sets_attrs_url()
    {
        $block = $this->socialLinkBlock(['service' => 'twitter']);

        $result = (new SocialLink())->apply($block, 'url', 'https://example.test/profile');

        $this->assertSame('https://example.test/profile', $result['attrs']['url']);
        $this->assertSame('twitter', $result['attrs']['service']);
    }

    public function test_apply_url_strips_dangerous_schemes()
    {
        foreach (['javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox(1)'] as $url) {
            $block  = $this->socialLinkBlock(['service' => 'twitter']);
            // esc_url_raw rejects the scheme → empty → attr left unset.
            $result = (new SocialLink())->apply($block, 'url', $url);

            $this->assertArrayNotHasKey('url', $result['attrs'], "url: {$url}");
        }
    }

    public function test_apply_url_empty_string_unsets_attr()
    {
        $block = $this->socialLinkBlock(['service' => 'twitter', 'url' => 'https://example.test']);

        $result = (new SocialLink())->apply($block, 'url', '');

        $this->assertArrayNotHasKey('url', $result['attrs']);
        $this->assertSame('twitter', $result['attrs']['service']);
    }

    public function test_apply_with_non_string_value_treats_as_empty()
    {
        $block = $this->socialLinkBlock(['url' => 'https://example.test']);

        $result = (new SocialLink())->apply($block, 'url', null);

        $this->assertArrayNotHasKey('url', $result['attrs']);
    }

    public function test_apply_with_unknown_field_returns_block_unchanged()
    {
        $block = $this->socialLinkBlock(['service' => 'twitter']);

        $this->assertSame($block, (new SocialLink())->apply($block, 'service', 'github'));
    }

    private function socialLinkBlock(array $attrs): array
    {
        return [
            'blockName'    => 'core/social-link',
            'attrs'        => $attrs,
            'innerBlocks'  => [],
            'innerHTML'    => '',
            'innerContent' => [],
        ];
    }
}
