<?php

namespace Extendify\Tests\Integration\Agent\Controllers;

use Extendify\Agent\Controllers\WPController;
use Extendify\QuickEdit\Controllers\SaveController;
use Extendify\Shared\Services\Import\Post;
use WP_UnitTestCase;

class WPControllerTest extends WP_UnitTestCase
{
    public function test_lock_post_prevents_importer_update()
    {
        $postId = self::factory()->post->create(['post_content' => '<p>original</p>']);
        $post = get_post($postId);

        $user = self::factory()->user->create();
        wp_set_current_user($user);

        $request = new \WP_REST_Request();
        $request->set_param('postId', $postId);
        WPController::lockPost($request);

        // Attempt to update as the cron user (no user).
        wp_set_current_user(0);
        $result = Post::update($post, '<p>imported content</p>');

        $this->assertWPError($result);
        $this->assertSame(1005, $result->get_error_code());
        $this->assertSame('<p>original</p>', get_post($postId)->post_content);
    }

    // A template-part block must load by (partSlug, blockId) using the same
    // preorder numbering TagTemplateParts assigns on the front end. Before the
    // template-part branch, getBlockCode read only postId, so a header CTA
    // could be saved but never opened — the click silently no-op'd.
    public function test_get_block_code_loads_template_part_block_by_slug()
    {
        $this->loginAsAdmin();
        $slug = $this->createHeaderPart(
            '<!-- wp:paragraph --><p>AAA</p><!-- /wp:paragraph -->'
            . '<!-- wp:group --><div class="wp-block-group">'
            . '<!-- wp:heading --><h2>BBB</h2><!-- /wp:heading -->'
            . '<!-- wp:paragraph --><p>CCC</p><!-- /wp:paragraph -->'
            . '</div><!-- /wp:group -->'
        );

        // Preorder: 1=paragraph(AAA) 2=group 3=heading(BBB) 4=paragraph(CCC).
        $req = new \WP_REST_Request();
        $req->set_param('partSlug', $slug);
        $req->set_param('blockId', 3);
        $res = WPController::getBlockCode($req);

        $this->assertSame(200, $res->get_status());
        $data = $res->get_data();
        $this->assertSame('core/heading', $data['name']);
        $this->assertStringContainsString('<h2>BBB</h2>', $data['block']);
    }

    // Parity: the block load resolves for (slug, N) must be the exact block save
    // mutates for (slug, N). Both share TemplatePartBlockFinder, so an edit aimed
    // at the loaded block lands there and nowhere else — no silent off-by-one
    // between two walks, the central correctness risk of this feature.
    public function test_template_part_load_and_save_resolve_the_same_block()
    {
        $this->loginAsAdmin();
        $slug = $this->createHeaderPart(
            '<!-- wp:paragraph --><p>AAA</p><!-- /wp:paragraph -->'
            . '<!-- wp:group --><div class="wp-block-group">'
            . '<!-- wp:heading --><h2>BBB</h2><!-- /wp:heading -->'
            . '<!-- wp:paragraph --><p>CCC</p><!-- /wp:paragraph -->'
            . '</div><!-- /wp:group -->'
        );

        $loadReq = new \WP_REST_Request();
        $loadReq->set_param('partSlug', $slug);
        $loadReq->set_param('blockId', 3);
        $loaded = WPController::getBlockCode($loadReq)->get_data();
        $this->assertStringContainsString('<h2>BBB</h2>', $loaded['block']);

        $saveReq = new \WP_REST_Request('POST', '/extendify/v1/quick-edit/save');
        $saveReq->set_header('Content-Type', 'application/json');
        $saveReq->set_body(wp_json_encode([
            'source'    => ['kind' => 'template-part', 'partSlug' => $slug],
            'blockId'   => 3,
            'blockType' => 'core/heading',
            'rawBlock'  => '<!-- wp:heading --><h2>ZZZ</h2><!-- /wp:heading -->',
        ]));
        $saveRes = SaveController::handleSave($saveReq);
        $this->assertSame(200, $saveRes->get_status());

        $template = get_block_template(get_stylesheet() . '//' . $slug, 'wp_template_part');
        $stored = get_post($template->wp_id)->post_content;
        $this->assertStringContainsString('<h2>ZZZ</h2>', $stored);
        $this->assertStringNotContainsString('<h2>BBB</h2>', $stored);
        $this->assertStringContainsString('<p>AAA</p>', $stored);
        $this->assertStringContainsString('<p>CCC</p>', $stored);
    }

    // The post path (postId + TagBlocks top-level numbering) stays unchanged by
    // the new template-part branch.
    public function test_get_block_code_post_path_still_resolves_block()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>one</p><!-- /wp:paragraph -->'
                . '<!-- wp:heading --><h2>two</h2><!-- /wp:heading -->',
        ]);

        $req = new \WP_REST_Request();
        $req->set_param('postId', $postId);
        $req->set_param('blockId', 2);
        $res = WPController::getBlockCode($req);

        $this->assertSame(200, $res->get_status());
        $data = $res->get_data();
        $this->assertSame('core/heading', $data['name']);
        $this->assertStringContainsString('<h2>two</h2>', $data['block']);
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }

    private function createHeaderPart(string $content): string
    {
        $slug = 'qe-header-' . wp_generate_password(6, false);
        $partId = self::factory()->post->create([
            'post_type'    => 'wp_template_part',
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_content' => $content,
        ]);
        wp_set_object_terms($partId, get_stylesheet(), 'wp_theme');
        return $slug;
    }
}
