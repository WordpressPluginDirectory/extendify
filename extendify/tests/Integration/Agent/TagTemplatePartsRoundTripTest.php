<?php

namespace Extendify\Tests\Integration\Agent;

use Extendify\Agent\Controllers\WPController;
use Extendify\Agent\TagTemplateParts;
use WP_Block_Type_Registry;
use WP_UnitTestCase;

// Pins the template-part twin of the TagBlocks round-trip seam: the render-time
// tagger (TagTemplateParts, which stamps data-extendify-part-block-id) and the
// load/save walk (TemplatePartBlockFinder, via WPController::getBlockCode) are
// two numberings of one preorder convention. If they drift, the client clicks
// block N in the header and the server loads/saves a DIFFERENT block N.
//
// The failure these pin is real and shipped: on a WooCommerce header, the
// mini-cart renders a drawer of inner blocks at render time that don't exist in
// the parsed tree, so every editable block after it (the CTA button) got a
// render-time id the static finder could never reach -> 404 on click. The fix
// is to skip dynamic self-rendering blocks on BOTH sides, the way TagBlocks
// already skips loop subtrees in post content.
class TagTemplatePartsRoundTripTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
        // Clear frames left by a prior test's render (statics persist across the
        // process). reset() only touches $frames — not the $ignored list.
        // Firing template_redirect here would trip redirect_canonical's headers.
        TagTemplateParts::reset();
        TagTemplateParts::init();
    }

    // The core pin: an editable block sitting AFTER a loop ($ignored) must get
    // the same id from the render-time tagger and the finder. The loop renders
    // its inner heading once per published post, so a one-sided skip would shift
    // "after" and the load would resolve the wrong block.
    public function test_block_after_ignored_loop_round_trips()
    {
        self::factory()->post->create(['post_status' => 'publish']);
        self::factory()->post->create(['post_status' => 'publish']);

        $slug = $this->createPart(
            '<!-- wp:paragraph --><p>before</p><!-- /wp:paragraph -->'
            . '<!-- wp:query {"queryId":1,"query":{"perPage":2,"postType":"post"}} -->'
            . '<div class="wp-block-query"><!-- wp:post-template -->'
            . '<!-- wp:heading --><h2>inside-loop</h2><!-- /wp:heading -->'
            . '<!-- /wp:post-template --></div>'
            . '<!-- /wp:query -->'
            . '<!-- wp:heading --><h2>after</h2><!-- /wp:heading -->'
        );

        $rendered = $this->renderPart($slug);

        $this->assertNull(
            $this->idForText($rendered, 'h2', 'inside-loop'),
            'a loop subtree inside a template part must not be tagged'
        );

        $afterId = $this->idForText($rendered, 'h2', 'after');
        $this->assertNotNull($afterId, 'the block after the loop must be tagged');
        $this->assertSame('after', $this->loadText($slug, $afterId, 'h2'));
    }

    // The mini-cart shape exactly: a dynamic block with NO parsed inner blocks
    // that renders extra blocks at render time. The finder sees one leaf; the
    // tagger must skip the injected subtree so the next block's id still lines
    // up. Without the fix the injected headings inflate every later id.
    public function test_block_after_dynamic_self_rendering_block_round_trips()
    {
        // WP-latest CI has WooCommerce active, so woocommerce/mini-cart is
        // already registered; re-registering trips a doing_it_wrong notice that
        // fails the test. Drop it first so the controlled stub render is used.
        $registry = WP_Block_Type_Registry::get_instance();
        if ($registry->is_registered('woocommerce/mini-cart')) {
            unregister_block_type('woocommerce/mini-cart');
        }
        register_block_type('woocommerce/mini-cart', [
            'render_callback' => static function () {
                // Real mini-cart wraps its drawer in a div; the tagger stamps the
                // block's first tag, so the wrapper (not an inner heading) carries
                // the id.
                return '<div class="wc-block-mini-cart">' . do_blocks(
                    '<!-- wp:heading --><h2>drawer-a</h2><!-- /wp:heading -->'
                    . '<!-- wp:heading --><h2>drawer-b</h2><!-- /wp:heading -->'
                ) . '</div>';
            },
        ]);

        $slug = $this->createPart(
            '<!-- wp:paragraph --><p>before</p><!-- /wp:paragraph -->'
            . '<!-- wp:woocommerce/mini-cart /-->'
            . '<!-- wp:button --><div class="wp-block-button">'
            . '<a class="wp-block-button__link">Shop Desks</a></div><!-- /wp:button -->'
        );

        $rendered = $this->renderPart($slug);

        $this->assertNull(
            $this->idForText($rendered, 'h2', 'drawer-a'),
            'a dynamic block render-injected subtree must not be tagged'
        );

        // core/button stamps its id on the block's first tag — the
        // <div class="wp-block-button"> wrapper, not the inner <a>.
        $buttonId = $this->idForText($rendered, 'div', 'Shop Desks');
        $this->assertNotNull($buttonId, 'the CTA after the dynamic block must be tagged');

        $loaded = WPController::getBlockCode($this->getBlockCodeReq($slug, $buttonId));
        $this->assertSame(200, $loaded->get_status());
        $this->assertSame('core/button', $loaded->get_data()['name']);

        unregister_block_type('woocommerce/mini-cart');
    }

    // Regression: nested non-ignored blocks are still counted in preorder by
    // both sides, so a heading inside a group resolves to the group's child.
    public function test_nested_non_ignored_block_round_trips()
    {
        $slug = $this->createPart(
            '<!-- wp:paragraph --><p>before</p><!-- /wp:paragraph -->'
            . '<!-- wp:group --><div class="wp-block-group">'
            . '<!-- wp:heading --><h2>nested</h2><!-- /wp:heading -->'
            . '</div><!-- /wp:group -->'
        );

        $rendered = $this->renderPart($slug);
        $nestedId = $this->idForText($rendered, 'h2', 'nested');
        $this->assertNotNull($nestedId, 'a nested non-ignored block must be tagged');
        $this->assertSame('nested', $this->loadText($slug, $nestedId, 'h2'));
    }

    private function createPart(string $content): string
    {
        $slug = 'qe-part-' . wp_generate_password(6, false);
        $partId = self::factory()->post->create([
            'post_type'    => 'wp_template_part',
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_content' => $content,
        ]);
        wp_set_object_terms($partId, get_stylesheet(), 'wp_theme');
        return $slug;
    }

    private function renderPart(string $slug): string
    {
        return do_blocks(
            '<!-- wp:template-part {"slug":"' . $slug . '","theme":"' . get_stylesheet() . '"} /-->'
        );
    }

    // Load via the same endpoint the client hits and return the trimmed text of
    // the first $tag in the returned block markup.
    private function loadText(string $slug, int $blockId, string $tag): ?string
    {
        $res = WPController::getBlockCode($this->getBlockCodeReq($slug, $blockId));
        if ($res->get_status() !== 200) {
            return null;
        }
        return $this->firstTagText($res->get_data()['block'], $tag);
    }

    private function getBlockCodeReq(string $slug, int $blockId): \WP_REST_Request
    {
        $req = new \WP_REST_Request();
        $req->set_param('partSlug', $slug);
        $req->set_param('blockId', $blockId);
        return $req;
    }

    private function idForText(string $html, string $tag, string $text): ?int
    {
        foreach ($this->nodes($html, $tag) as $node) {
            if (trim($node->textContent) === $text) {
                $id = $node->getAttribute('data-extendify-part-block-id');
                return $id === '' ? null : (int) $id;
            }
        }
        return null;
    }

    private function firstTagText(string $html, string $tag): ?string
    {
        foreach ($this->nodes($html, $tag) as $node) {
            return trim($node->textContent);
        }
        return null;
    }

    private function nodes(string $html, string $tag): \DOMNodeList
    {
        $dom = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8"?><div>' . $html . '</div>');
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        return (new \DOMXPath($dom))->query("//{$tag}");
    }
}
