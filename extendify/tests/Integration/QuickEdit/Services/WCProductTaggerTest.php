<?php

namespace Extendify\Tests\Integration\QuickEdit\Services;

use Extendify\QuickEdit\Services\WCProductTagger;
use WP_UnitTestCase;

class WCProductTaggerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        if (!function_exists('wc_get_product')) {
            $this->markTestSkipped('WooCommerce not loaded in this test environment.');
        }
        $this->loginAsAdmin();
    }

    public function test_init_registers_render_block_filter_at_priority_11()
    {
        remove_all_filters('render_block');

        WCProductTagger::init();

        $this->assertSame(
            11,
            has_filter('render_block', [WCProductTagger::class, 'tag'])
        );
    }

    public function test_tags_product_image_with_image_field()
    {
        $pid = $this->ensureProduct();
        $html = WCProductTagger::tag(
            '<figure class="wp-block-woocommerce-product-image"><img src="x" /></figure>',
            ['blockName' => 'woocommerce/product-image'],
            $this->blockObjFor($pid)
        );

        $this->assertStringContainsString(
            'data-extendify-quick-edit-product-id="' . $pid . '"',
            $html
        );
        $this->assertStringContainsString(
            'data-extendify-quick-edit-product-field="image"',
            $html
        );
    }

    public function test_tags_post_title_with_name_field()
    {
        $pid = $this->ensureProduct();
        $html = WCProductTagger::tag(
            '<h2>Product</h2>',
            ['blockName' => 'core/post-title'],
            $this->blockObjFor($pid)
        );

        $this->assertStringContainsString('data-extendify-quick-edit-product-field="name"', $html);
    }

    public function test_post_excerpt_and_product_summary_both_map_to_short_description()
    {
        $pid = $this->ensureProduct();

        $excerptHtml = WCProductTagger::tag(
            '<p>excerpt</p>',
            ['blockName' => 'core/post-excerpt'],
            $this->blockObjFor($pid)
        );
        $summaryHtml = WCProductTagger::tag(
            '<p>summary</p>',
            ['blockName' => 'woocommerce/product-summary'],
            $this->blockObjFor($pid)
        );

        $this->assertStringContainsString('product-field="short_description"', $excerptHtml);
        $this->assertStringContainsString('product-field="short_description"', $summaryHtml);
    }

    public function test_product_price_maps_to_price_field()
    {
        $pid = $this->ensureProduct();

        $html = WCProductTagger::tag(
            '<span class="woocommerce-Price-amount">$10</span>',
            ['blockName' => 'woocommerce/product-price'],
            $this->blockObjFor($pid)
        );

        $this->assertStringContainsString('product-field="price"', $html);
    }

    public function test_product_image_gallery_also_maps_to_image_field()
    {
        $pid = $this->ensureProduct();

        $html = WCProductTagger::tag(
            '<div class="wp-block-woocommerce-product-image-gallery"></div>',
            ['blockName' => 'woocommerce/product-image-gallery'],
            $this->blockObjFor($pid)
        );

        $this->assertStringContainsString('product-field="image"', $html);
    }

    public function test_unrelated_block_passes_through_unchanged()
    {
        $pid = $this->ensureProduct();
        $original = '<p>hello</p>';

        $html = WCProductTagger::tag($original, ['blockName' => 'core/paragraph'], $this->blockObjFor($pid));

        $this->assertSame($original, $html);
    }

    public function test_empty_html_passes_through()
    {
        $this->assertSame('', WCProductTagger::tag('', ['blockName' => 'core/post-title']));
    }

    public function test_skips_in_admin_context()
    {
        set_current_screen('edit-post');
        $pid = $this->ensureProduct();
        $original = '<h2>x</h2>';

        $html = WCProductTagger::tag($original, ['blockName' => 'core/post-title'], $this->blockObjFor($pid));

        $this->assertSame($original, $html);
        set_current_screen('front');
    }

    public function test_skips_when_logged_out()
    {
        wp_set_current_user(0);
        $pid = $this->ensureProduct();
        $original = '<h2>x</h2>';

        $html = WCProductTagger::tag($original, ['blockName' => 'core/post-title'], $this->blockObjFor($pid));

        $this->assertSame($original, $html);
    }

    public function test_skips_when_user_lacks_required_capability()
    {
        // Editor (edit_posts but not manage_options) is the meaningful
        // boundary post-lockdown; subscriber would skip anyway.
        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $pid = $this->ensureProduct();
        $original = '<h2>x</h2>';

        $html = WCProductTagger::tag($original, ['blockName' => 'core/post-title'], $this->blockObjFor($pid));

        $this->assertSame($original, $html);
    }

    public function test_skips_when_post_type_is_not_product()
    {
        $postId = self::factory()->post->create();
        $original = '<h2>regular post</h2>';

        $html = WCProductTagger::tag(
            $original,
            ['blockName' => 'core/post-title'],
            $this->blockObjFor($postId)
        );

        $this->assertSame($original, $html);
    }

    public function test_skips_when_block_object_has_no_postId_context()
    {
        $this->ensureProduct();
        $original = '<h2>no context</h2>';

        $blockObj = (object) ['context' => []];
        $html = WCProductTagger::tag($original, ['blockName' => 'core/post-title'], $blockObj);

        $this->assertSame($original, $html);
    }

    public function test_skips_when_block_object_is_null_and_not_on_product_page()
    {
        $this->ensureProduct();
        $original = '<h2>no obj</h2>';

        $html = WCProductTagger::tag($original, ['blockName' => 'core/post-title'], null);

        $this->assertSame($original, $html);
    }

    public function test_wrap_description_tab_wraps_callback_output_with_field_attrs()
    {
        $pid = $this->ensureProduct();
        // Sets up the loop globals so get_the_ID() returns the product
        // inside the wrapped callback — that's how WC fires the tab on a
        // real single-product page.
        $GLOBALS['post'] = get_post($pid);
        setup_postdata($GLOBALS['post']);

        $tabs = [
            'description' => [
                'callback' => static function () {
                    echo '<h2>Description</h2><p>body</p>';
                },
            ],
        ];
        $wrapped = WCProductTagger::wrapDescriptionTab($tabs);

        ob_start();
        call_user_func($wrapped['description']['callback']);
        $out = ob_get_clean();

        wp_reset_postdata();
        unset($GLOBALS['post']);

        $this->assertStringContainsString(
            'data-extendify-quick-edit-product-id="' . $pid . '"',
            $out
        );
        $this->assertStringContainsString(
            'data-extendify-quick-edit-product-field="description"',
            $out
        );
        $this->assertStringContainsString('<h2>Description</h2><p>body</p>', $out);
    }

    public function test_wrap_description_tab_passes_through_when_no_description_tab()
    {
        $tabs = ['reviews' => ['callback' => '__return_null']];
        $out = WCProductTagger::wrapDescriptionTab($tabs);
        $this->assertSame($tabs, $out);
    }

    public function test_wrap_description_tab_falls_back_to_original_when_not_on_a_product()
    {
        // No global $post + no is_product() → get_the_ID returns 0 inside
        // the wrapped callback, so the wrap branch bails and just calls
        // the original. Spec: the user sees the tab content as before;
        // we don't risk corrupting non-product output.
        $tabs = [
            'description' => [
                'callback' => static function () {
                    echo '<p>original</p>';
                },
            ],
        ];
        $wrapped = WCProductTagger::wrapDescriptionTab($tabs);

        ob_start();
        call_user_func($wrapped['description']['callback']);
        $out = ob_get_clean();

        $this->assertSame('<p>original</p>', $out);
    }

    public function test_does_not_double_tag()
    {
        $pid = $this->ensureProduct();
        $first = WCProductTagger::tag(
            '<h2>x</h2>',
            ['blockName' => 'core/post-title'],
            $this->blockObjFor($pid)
        );

        $second = WCProductTagger::tag(
            $first,
            ['blockName' => 'core/post-title'],
            $this->blockObjFor($pid)
        );

        $this->assertSame($first, $second);
        $this->assertSame(1, substr_count($second, 'data-extendify-quick-edit-product-id='));
    }

    private function ensureProduct(): int
    {
        return self::factory()->post->create([
            'post_type'   => 'product',
            'post_title'  => 'Test Product',
            'post_status' => 'publish',
        ]);
    }

    private function blockObjFor(int $productId): object
    {
        return (object) ['context' => ['postId' => $productId]];
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }
}
