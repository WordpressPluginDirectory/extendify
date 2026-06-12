<?php

namespace Extendify\Tests\Integration\QuickEdit\Services;

use Extendify\QuickEdit\Services\IdentityTagger;
use WP_UnitTestCase;

class IdentityTaggerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
    }

    public function test_init_registers_render_block_filter_at_priority_12()
    {
        remove_all_filters('render_block');

        IdentityTagger::init();

        $this->assertSame(
            12,
            has_filter('render_block', [IdentityTagger::class, 'tag'])
        );
    }

    public function test_tags_core_site_title_with_kind_title()
    {
        $html = IdentityTagger::tag(
            '<h1 class="wp-block-site-title">Site</h1>',
            $this->block('core/site-title')
        );

        $this->assertStringContainsString('data-extendify-quick-edit-identity="title"', $html);
    }

    public function test_tags_core_site_tagline_with_kind_tagline()
    {
        $html = IdentityTagger::tag(
            '<p class="wp-block-site-tagline">Tagline</p>',
            $this->block('core/site-tagline')
        );

        $this->assertStringContainsString('data-extendify-quick-edit-identity="tagline"', $html);
    }

    public function test_tags_core_site_logo_with_kind_logo()
    {
        $html = IdentityTagger::tag(
            '<a class="wp-block-site-logo"><img src="x" /></a>',
            $this->block('core/site-logo')
        );

        $this->assertStringContainsString('data-extendify-quick-edit-identity="logo"', $html);
    }

    public function test_unrelated_block_name_passes_through_unchanged()
    {
        $original = '<p>hello</p>';
        $html = IdentityTagger::tag($original, $this->block('core/paragraph'));

        $this->assertSame($original, $html);
    }

    public function test_empty_html_passes_through_unchanged()
    {
        $this->assertSame('', IdentityTagger::tag('', $this->block('core/site-title')));
    }

    public function test_non_string_html_passes_through_unchanged()
    {
        // The filter signature lets non-string values through (e.g. when an
        // earlier filter returned null); the tagger must not crash.
        $this->assertNull(IdentityTagger::tag(null, $this->block('core/site-title')));
    }

    public function test_skips_when_admin_context()
    {
        set_current_screen('edit-post');
        $original = '<h1>Site</h1>';

        $html = IdentityTagger::tag($original, $this->block('core/site-title'));

        $this->assertSame($original, $html);
        set_current_screen('front');
    }

    public function test_skips_when_user_is_logged_out()
    {
        wp_set_current_user(0);
        $original = '<h1>Site</h1>';

        $html = IdentityTagger::tag($original, $this->block('core/site-title'));

        $this->assertSame($original, $html);
    }

    public function test_skips_when_user_lacks_manage_options()
    {
        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $original = '<h1>Site</h1>';

        $html = IdentityTagger::tag($original, $this->block('core/site-title'));

        $this->assertSame($original, $html);
    }

    public function test_does_not_double_tag()
    {
        $first  = IdentityTagger::tag('<h1>Site</h1>', $this->block('core/site-title'));
        $second = IdentityTagger::tag($first, $this->block('core/site-title'));

        $this->assertSame($first, $second);
        $this->assertSame(
            1,
            substr_count($second, 'data-extendify-quick-edit-identity=')
        );
    }

    public function test_tag_goes_on_the_first_html_element_only()
    {
        $html = IdentityTagger::tag(
            '<div><h1>Site</h1></div>',
            $this->block('core/site-title')
        );

        // First tag is the wrapping <div>, not the inner <h1>.
        $this->assertStringContainsString(
            '<div data-extendify-quick-edit-identity="title">',
            $html
        );
        $this->assertStringNotContainsString(
            '<h1 data-extendify-quick-edit-identity',
            $html
        );
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }

    private function block(string $blockName): array
    {
        return [
            'blockName'    => $blockName,
            'attrs'        => [],
            'innerBlocks'  => [],
            'innerHTML'    => '',
            'innerContent' => [],
        ];
    }
}
