<?php

namespace Extendify\Tests\Integration\QuickEdit;

use Extendify\Agent\TagBlocks;
use Extendify\QuickEdit\Controllers\SaveController;
use Extendify\QuickEdit\Schemas\Registry;
use ReflectionClass;
use WP_UnitTestCase;

// Pins the QuickEdit <-> Agent seam: the
// render-time tagger (Agent\TagBlocks) and the save-path re-derivation
// (QuickEdit\SaveController::findBlock) are two hand-maintained twins of one
// preorder-numbering convention. If they drift, the client clicks block N and
// the server saves into a *different* block N — silent content corruption.
//
// Every other SaveControllerTest case hardcodes blockId (a human's manual
// count), so none of them would catch the two walks diverging. These tests
// instead run real content through the genuine the_content filter chain with
// TagBlocks active, read the actual data-extendify-agent-block-id the tagger
// emitted onto the rendered DOM, then feed THAT id back into handleSave — the
// only way to assert the two numberings stay in lockstep, including across an
// $ignored (loop) subtree where a divergent skip would shift every later id.
class TagBlocksRoundTripTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
        $this->resetRegistry();
        Registry::init();
        // WP_UnitTestCase restores $wp_filter per test, so this registers
        // TagBlocks' the_content/render_block filters exactly once per case —
        // no enterScope stacking that would push scope depth past 1.
        unset($GLOBALS['extendify_agent_scope']);
        TagBlocks::init();
    }

    public function tearDown(): void
    {
        $this->resetRegistry();
        unset($GLOBALS['extendify_agent_scope']);
        parent::tearDown();
    }

    // The core lockstep pin: an editable block sitting AFTER an $ignored loop
    // must get the same id from the render-time tagger and the save-path walk.
    // The loop's inner heading is counted by neither side — if either skip
    // diverged, "bravo" would tag/resolve at a different id and the save would
    // land on the wrong block (or on the loop's inner block).
    public function test_block_id_round_trips_across_an_ignored_loop()
    {
        // 2 published posts so the post-template actually renders its inner
        // heading per item at render time — exercising the "skip a subtree that
        // renders once per loop item" path, not just an empty query.
        self::factory()->post->create(['post_status' => 'publish']);
        self::factory()->post->create(['post_status' => 'publish']);

        $content = '<!-- wp:heading --><h2>alpha</h2><!-- /wp:heading -->'
            . '<!-- wp:query {"queryId":1,"query":{"perPage":2,"postType":"post"}} -->'
            . '<div class="wp-block-query">'
            . '<!-- wp:post-template -->'
            . '<!-- wp:heading --><h2>inside-loop</h2><!-- /wp:heading -->'
            . '<!-- /wp:post-template -->'
            . '</div>'
            . '<!-- /wp:query -->'
            . '<!-- wp:heading --><h2>bravo</h2><!-- /wp:heading -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $rendered = $this->renderTagged($postId);

        // The tagger skipped the whole core/query subtree, so the loop's inner
        // heading carries no id at all.
        $this->assertNull(
            $this->idForText($rendered, 'h2', 'inside-loop'),
            'an $ignored loop subtree must not be tagged'
        );

        // Feed the id the tagger actually emitted onto "bravo" back to save.
        // No fingerprint on purpose: that isolates the count path so a
        // one-sided skip drift fails loudly (wrong-type 409 / wrong block)
        // instead of being silently recovered by fingerprint identity — the
        // recovery net is already pinned by SaveControllerTest's fingerprint
        // cases; this test exists to pin the numbering itself.
        $bravoId = $this->idForText($rendered, 'h2', 'bravo');
        $this->assertNotNull($bravoId, 'the block after the loop must be tagged');

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => $bravoId,
            'blockType' => 'core/heading',
            'patches'   => [['fieldKey' => 'content', 'value' => 'bravo-edited']],
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        // The save resolved the SAME block the tagger pointed at: bravo edited,
        // its siblings (and the loop template) untouched.
        $this->assertStringContainsString('<h2>bravo-edited</h2>', $stored);
        $this->assertStringContainsString('<h2>alpha</h2>', $stored);
        $this->assertStringContainsString('<h2>inside-loop</h2>', $stored);
    }

    // The other half of the walk: nested (non-ignored) children ARE counted in
    // preorder by both sides. A heading inside a group must round-trip to the
    // group's child, not the group wrapper or a sibling.
    public function test_block_id_round_trips_through_nested_groups()
    {
        $content = '<!-- wp:heading --><h2>outer</h2><!-- /wp:heading -->'
            . '<!-- wp:group {"layout":{"type":"constrained"}} -->'
            . '<div class="wp-block-group">'
            . '<!-- wp:heading --><h2>nested</h2><!-- /wp:heading -->'
            . '</div>'
            . '<!-- /wp:group -->'
            . '<!-- wp:heading --><h2>after</h2><!-- /wp:heading -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $rendered = $this->renderTagged($postId);

        $nestedId = $this->idForText($rendered, 'h2', 'nested');
        $this->assertNotNull($nestedId, 'a nested non-ignored block must be tagged');

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => $nestedId,
            'blockType' => 'core/heading',
            'patches'   => [['fieldKey' => 'content', 'value' => 'nested-edited']],
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<h2>nested-edited</h2>', $stored);
        $this->assertStringContainsString('<h2>outer</h2>', $stored);
        $this->assertStringContainsString('<h2>after</h2>', $stored);
    }

    // Render the post's content through the same the_content chain a live page
    // runs, with TagBlocks active, and return the tagged HTML. Mirrors
    // SaveController::renderBlockHtml's global-$post snapshot/restore so a
    // dangling global can't leak into other tests.
    private function renderTagged(int $postId): string
    {
        $post = get_post($postId);
        $previousPost = $GLOBALS['post'] ?? null;
        $GLOBALS['post'] = $post;
        setup_postdata($post);
        // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core WP filter
        $html = (string) apply_filters('the_content', $post->post_content);
        wp_reset_postdata();
        $GLOBALS['post'] = $previousPost;
        return $html;
    }

    // The id the tagger appended to the first tag of $tag whose text is $text,
    // or null when that node carries no id (e.g. it sat inside an $ignored
    // subtree). Reads the real emitted attribute — the whole point of the pin.
    private function idForText(string $html, string $tag, string $text): ?int
    {
        $dom = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8"?><div>' . $html . '</div>');
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new \DOMXPath($dom);
        foreach ($xpath->query("//{$tag}") as $node) {
            if (trim($node->textContent) === $text) {
                $id = $node->getAttribute('data-extendify-agent-block-id');
                return $id === '' ? null : (int) $id;
            }
        }
        return null;
    }

    private function jsonRequest(array $body): \WP_REST_Request
    {
        $req = new \WP_REST_Request('POST', '/extendify/v1/quick-edit/save');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode($body));
        return $req;
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }

    private function resetRegistry(): void
    {
        $reflection = new ReflectionClass(Registry::class);
        $prop = $reflection->getProperty('schemas');
        $prop->setAccessible(true);
        $prop->setValue(null, []);
    }
}
