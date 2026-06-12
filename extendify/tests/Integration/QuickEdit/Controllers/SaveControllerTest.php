<?php

namespace Extendify\Tests\Integration\QuickEdit\Controllers;

use Extendify\QuickEdit\Controllers\SaveController;
use Extendify\QuickEdit\Schemas\Registry;
use ReflectionClass;
use WP_UnitTestCase;

class SaveControllerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->resetRegistry();
        Registry::init();
    }

    public function tearDown(): void
    {
        $this->resetRegistry();
        delete_option('trp_settings');
        unset($GLOBALS['TRP_LANGUAGE']);
        parent::tearDown();
    }

    public function test_permission_callback_requires_admin_capability()
    {
        wp_set_current_user(0);
        $this->assertFalse(SaveController::permissionCallback());

        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $this->assertFalse(SaveController::permissionCallback());

        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
        $this->assertTrue(SaveController::permissionCallback());
    }

    public function test_missing_required_fields_returns_400()
    {
        $this->loginAsAdmin();
        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => 1],
            // no blockId, no blockType, no patches/rawBlock
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertStringContainsString('required', $res->get_data()['error']);
    }

    public function test_unknown_block_type_with_patches_returns_400_no_schema()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'not/a-real-block',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(400, $res->get_status());
        $data = $res->get_data();
        $this->assertSame('no schema registered for block type', $data['error']);
        $this->assertSame('not/a-real-block', $data['blockType']);
    }

    public function test_post_not_found_returns_404()
    {
        $this->loginAsAdmin();
        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => 99999999],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
    }

    public function test_unknown_source_kind_returns_404()
    {
        $this->loginAsAdmin();
        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'bogus'],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('unknown source kind', $res->get_data()['error']);
    }

    public function test_template_part_requires_partSlug()
    {
        $this->loginAsAdmin();
        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'template-part'],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('template-part requires partSlug', $res->get_data()['error']);
    }

    public function test_subscriber_user_forbidden_per_source()
    {
        $sub = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($sub);
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(403, $res->get_status());
        $this->assertSame('forbidden for this source', $res->get_data()['error']);
    }

    // The post-path object check is edit_post on the *specific* id,
    // not the coarse edit_posts. An author holds edit_posts but not
    // edit_others_posts, so a save against another author's post must 403 —
    // even with the global gate lowered enough to let the author in. Mutating
    // userCanEditSource to current_user_can('edit_posts') reopens this.
    public function test_post_save_forbidden_when_editing_another_authors_post()
    {
        $owner = self::factory()->user->create(['role' => 'author']);
        $postId = self::factory()->post->create([
            'post_author'  => $owner,
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $attacker = self::factory()->user->create(['role' => 'author']);
        wp_set_current_user($attacker);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'tampered']],
        ]));

        $this->assertSame(403, $res->get_status());
        $this->assertSame('forbidden for this source', $res->get_data()['error']);
        $this->assertStringContainsString('<p>hi</p>', get_post($postId)->post_content);
    }

    // Template parts gate on edit_theme_options, independent of the
    // post-edit world. An editor can edit others' posts but lacks
    // edit_theme_options, so a template-part save must 403. Mutating
    // userCanEditSource's template-part branch to edit_post/edit_posts (which
    // the editor passes) reopens this.
    public function test_template_part_save_forbidden_for_user_without_edit_theme_options()
    {
        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $this->assertTrue(current_user_can('edit_others_posts'));
        $this->assertFalse(current_user_can('edit_theme_options'));

        $slug = 'qe-test-part-' . wp_generate_password(6, false);
        $partId = self::factory()->post->create([
            'post_type'    => 'wp_template_part',
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_content' => '<!-- wp:paragraph --><p>part-old</p><!-- /wp:paragraph -->',
        ]);
        wp_set_object_terms($partId, get_stylesheet(), 'wp_theme');

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'template-part', 'partSlug' => $slug],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'part-new']],
        ]));

        $this->assertSame(403, $res->get_status());
        $this->assertSame('forbidden for this source', $res->get_data()['error']);
        $this->assertStringContainsString('<p>part-old</p>', get_post($partId)->post_content);
    }

    public function test_blockId_past_end_of_walk_returns_404_with_diagnostics()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 99,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('block not found in source', $res->get_data()['error']);
        $this->assertSame(99, $res->get_data()['blockId']);
    }

    public function test_block_type_mismatch_returns_409_without_writing()
    {
        $this->loginAsAdmin();
        $originalContent = '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $originalContent]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/heading',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(409, $res->get_status());
        $data = $res->get_data();
        $this->assertSame('block type mismatch', $data['error']);
        $this->assertSame('core/heading', $data['expected']);
        $this->assertSame('core/paragraph', $data['actual']);
        $this->assertSame($originalContent, get_post($postId)->post_content);
    }

    public function test_successful_patch_updates_post_and_returns_rendered_html()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'updated']],
        ]));

        $this->assertSame(200, $res->get_status());
        $data = $res->get_data();
        $this->assertTrue($data['ok']);
        $this->assertSame(1, $data['blockId']);
        $this->assertSame('core/paragraph', $data['blockType']);
        $this->assertStringContainsString('updated', $data['rendered']);

        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<p>updated</p>', $stored);
        $this->assertStringContainsString('<!-- wp:paragraph -->', $stored);
    }

    public function test_patches_applied_in_order()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [
                ['fieldKey' => 'content', 'value' => 'first'],
                ['fieldKey' => 'content', 'value' => 'second'],
            ],
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('<p>second</p>', get_post($postId)->post_content);
    }

    public function test_rawBlock_must_parse_to_exactly_one_block()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $two = '<!-- wp:paragraph --><p>a</p><!-- /wp:paragraph -->'
             . '<!-- wp:paragraph --><p>b</p><!-- /wp:paragraph -->';

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => $two,
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('rawBlock must parse to exactly one block', $res->get_data()['error']);
        $this->assertSame(2, $res->get_data()['parsed_count']);
    }

    public function test_rawBlock_type_must_match_blockType()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => '<!-- wp:heading --><h2>x</h2><!-- /wp:heading -->',
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('rawBlock type does not match blockType', $res->get_data()['error']);
        $this->assertSame('core/paragraph', $res->get_data()['expected']);
        $this->assertSame('core/heading', $res->get_data()['got']);
    }

    public function test_rawBlock_path_bypasses_schema_apply()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => '<!-- wp:paragraph {"align":"right"} --><p class="has-text-align-right">whole-block</p><!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<p class="has-text-align-right">whole-block</p>', $stored);
        $this->assertStringContainsString('{"align":"right"}', $stored);
    }

    public function test_rawBlock_path_works_even_when_no_schema_registered()
    {
        $this->loginAsAdmin();
        // Wipe registry: rawBlock should still save.
        $this->resetRegistry();

        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => '<!-- wp:paragraph --><p>whole</p><!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
    }

    public function test_round_trip_preserves_block_structure_of_unrelated_siblings()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>first</p><!-- /wp:paragraph -->'
                 . '<!-- wp:heading --><h2>middle</h2><!-- /wp:heading -->'
                 . '<!-- wp:paragraph --><p>last</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        // Edit only the middle heading (blockId=2 in TagBlocks counting).
        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 2,
            'blockType' => 'core/heading',
            'patches'   => [['fieldKey' => 'content', 'value' => 'new-middle']],
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<p>first</p>', $stored);
        $this->assertStringContainsString('<h2>new-middle</h2>', $stored);
        $this->assertStringContainsString('<p>last</p>', $stored);
    }

    public function test_template_part_resolves_by_slug()
    {
        $this->loginAsAdmin();
        $slug = 'qe-test-part-' . wp_generate_password(6, false);
        $partId = self::factory()->post->create([
            'post_type'    => 'wp_template_part',
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_content' => '<!-- wp:paragraph --><p>part-old</p><!-- /wp:paragraph -->',
        ]);
        wp_set_object_terms($partId, get_stylesheet(), 'wp_theme');

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'template-part', 'partSlug' => $slug],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'part-new']],
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('<p>part-new</p>', get_post($partId)->post_content);
    }

    // Real-world repro: an install that had `extendable` and `extendable-2`
    // both active at different points ends up with two wp_template_part
    // posts sharing post_name='header', one per wp_theme term. WP's render
    // path scopes to the current theme via get_block_template; raw
    // get_posts(name=...) doesn't, so a save-side resolver built on
    // get_posts patches the wrong row and the findBlock parse walk runs
    // against an unrelated post_content (the user's diagnostic dump:
    // 11 blocks visited, none of them the social-link the client clicked).
    //
    // Bypass wp_unique_post_slug with a direct $wpdb update so both posts
    // really share the slug — wp_insert_post auto-suffixes `-2` when terms
    // aren't set at insertion time, which masks this scenario in tests.
    public function test_template_part_duplicate_slug_resolves_via_active_theme()
    {
        global $wpdb;
        $this->loginAsAdmin();
        $slug = sanitize_title('qe-test-dup-' . wp_generate_password(6, false));

        $activeThemePartId = self::factory()->post->create([
            'post_type'    => 'wp_template_part',
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_content' => '<!-- wp:paragraph --><p>active-old</p><!-- /wp:paragraph -->',
        ]);
        wp_set_object_terms($activeThemePartId, get_stylesheet(), 'wp_theme');

        $orphanThemePartId = self::factory()->post->create([
            'post_type'    => 'wp_template_part',
            'post_name'    => "{$slug}-renamed-by-uniqueness",
            'post_status'  => 'publish',
            'post_content' => '<!-- wp:paragraph --><p>orphan-untouched</p><!-- /wp:paragraph -->',
        ]);
        wp_set_object_terms($orphanThemePartId, 'qe-test-other-theme', 'wp_theme');
        // Bypass wp_unique_post_slug + force the orphan to win get_posts'
        // default date-DESC ordering, mirroring the user's diagnostic
        // (orphan = newer modified-row, active = older modified-row).
        $wpdb->update(
            $wpdb->posts,
            [
                'post_name'     => $slug,
                'post_date'     => '2099-01-01 00:00:00',
                'post_date_gmt' => '2099-01-01 00:00:00',
            ],
            ['ID' => $orphanThemePartId]
        );
        clean_post_cache($orphanThemePartId);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'template-part', 'partSlug' => $slug],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'active-new']],
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('<p>active-new</p>', get_post($activeThemePartId)->post_content);
        $this->assertStringContainsString('<p>orphan-untouched</p>', get_post($orphanThemePartId)->post_content);
    }

    public function test_disallowed_post_type_revision_returns_404()
    {
        $this->loginAsAdmin();
        $parentId   = self::factory()->post->create(['post_status' => 'publish']);
        $revisionId = self::factory()->post->create([
            'post_type'    => 'revision',
            'post_parent'  => $parentId,
            'post_status'  => 'inherit',
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $revisionId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertStringContainsString('dedicated endpoint', $res->get_data()['error']);
    }

    public function test_disallowed_post_type_wp_template_returns_404()
    {
        $this->loginAsAdmin();
        $templateId = self::factory()->post->create([
            'post_type'    => 'wp_template',
            'post_status'  => 'publish',
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $templateId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertStringContainsString('dedicated endpoint', $res->get_data()['error']);
    }

    public function test_disallowed_post_type_wp_block_returns_404()
    {
        $this->loginAsAdmin();
        $reusableId = self::factory()->post->create([
            'post_type'    => 'wp_block',
            'post_status'  => 'publish',
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $reusableId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertStringContainsString('dedicated endpoint', $res->get_data()['error']);
    }

    public function test_auto_draft_post_via_post_kind_returns_404()
    {
        $this->loginAsAdmin();
        $autoDraftId = self::factory()->post->create([
            'post_status'  => 'auto-draft',
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $autoDraftId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'x']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertStringContainsString('dedicated endpoint', $res->get_data()['error']);
    }

    public function test_rawBlock_disallowed_block_type_returns_400()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:list --><ul><li>hi</li></ul><!-- /wp:list -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/list',
            'rawBlock'  => '<!-- wp:list --><ul><li>x</li></ul><!-- /wp:list -->',
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('rawBlock not supported for this block type', $res->get_data()['error']);
    }

    public function test_rawBlock_innerHTML_is_ksesd_in_stored_and_rendered()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
        ]);

        $malicious = '<!-- wp:paragraph --><p>hello<script>alert(1)</script>'
                   . '<img src="y" onerror="steal()"></p><!-- /wp:paragraph -->';

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => $malicious,
        ]));

        $this->assertSame(200, $res->get_status());

        $stored   = get_post($postId)->post_content;
        $rendered = $res->get_data()['rendered'];

        $this->assertStringContainsString('hello', $stored);
        $this->assertStringNotContainsString('<script', $stored);
        $this->assertStringNotContainsString('onerror', $stored);
        $this->assertStringNotContainsString('<script', $rendered);
        $this->assertStringNotContainsString('onerror', $rendered);
    }

    // innerHTML is kses'd, but the block-comment `attrs` JSON is client-supplied
    // and never sanitized by QuickEdit. An attribute-borne payload still can't
    // reach an executable sink: serialize_block
    // re-encodes attrs as JSON (angle brackets become < inside the comment),
    // unknown attrs are dropped at render, and supported attrs (style/fontSize)
    // run through core's render-time sanitizers. Stored AND rendered must be clean.
    public function test_rawBlock_malicious_attrs_never_reach_stored_or_rendered()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
        ]);

        $attrPayloads = [
            '{"className":"x\"><script>alert(1)</script>"}',
            '{"style":{"color":{"text":"red;}</style><script>alert(1)</script>"}}}',
            '{"fontSize":"x\"><script>alert(1)</script>"}',
            '{"evil":"</p><script>alert(1)</script>"}',
        ];

        foreach ($attrPayloads as $attrs) {
            wp_update_post([
                'ID'           => $postId,
                'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
            ]);
            $res = SaveController::handleSave($this->jsonRequest([
                'source'    => ['kind' => 'post', 'id' => $postId],
                'blockId'   => 1,
                'blockType' => 'core/paragraph',
                'rawBlock'  => '<!-- wp:paragraph ' . $attrs . ' --><p>hi</p><!-- /wp:paragraph -->',
            ]));

            $this->assertSame(200, $res->get_status(), "attrs: {$attrs}");
            $stored   = get_post($postId)->post_content;
            $rendered = $res->get_data()['rendered'];
            $this->assertStringNotContainsString('<script', $stored, "stored attrs: {$attrs}");
            $this->assertStringNotContainsString('<script', $rendered, "rendered attrs: {$attrs}");
        }
    }

    // The patches path runs every value through its schema sanitizer; this
    // exercises it end-to-end through handleSave (not just the schema unit):
    // a javascript: button url is stripped before it reaches post_content.
    public function test_patch_url_javascript_scheme_is_stripped_in_stored_content()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:button --><div class="wp-block-button">'
                . '<a class="wp-block-button__link" href="http://ok">go</a>'
                . '</div><!-- /wp:button -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/button',
            'patches'   => [['fieldKey' => 'url', 'value' => 'javascript:alert(1)']],
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringNotContainsString('javascript:', $stored);
        $this->assertStringNotContainsString('href=', $stored);
    }

    // The rawBlock path kses's innerHTML but never esc_url_raw's the url, and
    // core/button is the only url-carrying type it accepts. kses strips the
    // javascript: scheme from the href; the comment-attr url survives verbatim
    // but a static block never re-emits it, so neither exit is executable.
    public function test_rawBlock_button_javascript_url_never_reaches_rendered_or_stored_href()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:button --><div class="wp-block-button">'
                . '<a class="wp-block-button__link" href="http://ok">go</a>'
                . '</div><!-- /wp:button -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/button',
            'rawBlock'  => '<!-- wp:button {"url":"javascript:alert(1)"} -->'
                . '<div class="wp-block-button">'
                . '<a class="wp-block-button__link" href="javascript:alert(1)">x</a>'
                . '</div><!-- /wp:button -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored   = get_post($postId)->post_content;
        $rendered = $res->get_data()['rendered'];
        $this->assertStringNotContainsString('javascript:', $rendered);
        $this->assertStringNotContainsString('href="javascript:', $stored);
    }

    public function test_rawBlock_heading_passes_allowlist_and_keeps_safe_markup()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:heading --><h2>old</h2><!-- /wp:heading -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/heading',
            'rawBlock'  => '<!-- wp:heading --><h2>Safe <strong>title</strong></h2><!-- /wp:heading -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<h2>Safe <strong>title</strong></h2>', $stored);
    }

    // The header phone CTA is a core/paragraph whose only content is a tel:
    // link (AutoLaunch's ext-nav-extras-phone). Editing the visible digits in
    // RichText keeps the link format but only swaps the text, so the anchor's
    // href/data-id stay pointed at the OLD number and tap-to-call would dial
    // the stale digits. The save must re-point href + data-id (and pin
    // data-type) at the number the user now sees.
    public function test_phone_paragraph_tel_link_syncs_to_edited_digits()
    {
        $this->loginAsAdmin();
        $slug = 'qe-test-header-' . wp_generate_password(6, false);
        $partId = self::factory()->post->create([
            'post_type'    => 'wp_template_part',
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_content' => '<!-- wp:paragraph {"className":"no-underline"} -->'
                . '<p class="no-underline"><a href="tel:206-555-0100" data-type="tel" data-id="tel:206-555-0100">206-555-0100</a></p>'
                . '<!-- /wp:paragraph -->',
        ]);
        wp_set_object_terms($partId, get_stylesheet(), 'wp_theme');

        // RichText preserves the anchor (href/data-id stale) and changes text only.
        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'template-part', 'partSlug' => $slug],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => '<!-- wp:paragraph {"className":"no-underline"} -->'
                . '<p class="no-underline"><a href="tel:206-555-0100" data-type="tel" data-id="tel:206-555-0100">206-555-9999</a></p>'
                . '<!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored   = get_post($partId)->post_content;
        $rendered = $res->get_data()['rendered'];

        // All three anchor attributes track the edited digits and agree.
        $this->assertStringContainsString('href="tel:2065559999"', $stored);
        $this->assertStringContainsString('data-id="tel:2065559999"', $stored);
        $this->assertStringContainsString('data-type="tel"', $stored);
        // The stale number is gone from the link target...
        $this->assertStringNotContainsString('tel:206-555-0100', $stored);
        // ...but the visible digits the user typed are left untouched.
        $this->assertStringContainsString('>206-555-9999<', $stored);
        // The re-rendered HTML spliced into the live DOM dials the new number.
        $this->assertStringContainsString('href="tel:2065559999"', $rendered);
    }

    // A leading + (international dialing prefix) is the one non-digit kept; the
    // rest of the visual formatting (spaces, parens, dashes) is stripped.
    public function test_phone_paragraph_keeps_leading_plus_for_international_numbers()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p><a href="tel:2065550100" data-type="tel" data-id="tel:2065550100">206-555-0100</a></p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => '<!-- wp:paragraph --><p><a href="tel:2065550100" data-type="tel" data-id="tel:2065550100">+1 (206) 555-0199</a></p><!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('href="tel:+12065550199"', $stored);
        $this->assertStringContainsString('data-id="tel:+12065550199"', $stored);
    }

    // The rewrite is scoped to tel: links: a paragraph whose link is an
    // ordinary http(s) URL is saved exactly as the editor serialized it.
    public function test_paragraph_with_http_link_is_left_untouched()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => '<!-- wp:paragraph --><p>Visit <a href="https://example.com/contact">our page</a> today</p><!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('href="https://example.com/contact"', $stored);
        $this->assertStringNotContainsString('tel:', $stored);
    }

    // If the edited text yields no usable phone number, leave the existing
    // tel: href intact rather than writing a broken link.
    public function test_tel_link_with_unparseable_text_keeps_prior_href()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'rawBlock'  => '<!-- wp:paragraph --><p><a href="tel:206-555-0100" data-type="tel" data-id="tel:206-555-0100">Call us today!</a></p><!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('href="tel:206-555-0100"', $stored);
        $this->assertStringContainsString('Call us today!', $stored);
    }

    public function test_init_hooks_registerRoutes_into_rest_api_init()
    {
        remove_all_filters('rest_api_init');
        SaveController::init();

        $this->assertNotFalse(
            has_action('rest_api_init', [SaveController::class, 'registerRoutes'])
        );
    }

    // Block ids are best-effort (render-time vs parse-time can diverge). When
    // the count lands on the wrong same-type block, the fingerprint identifies
    // the one the user clicked — recover to it rather than refusing or
    // corrupting the counted block.
    public function test_fingerprint_recovers_to_matching_block_when_count_misresolves()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>alpha</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>bravo</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        // blockId 1 counts to "alpha", but the user clicked "bravo".
        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 1,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'bravo'],
            'patches'     => [['fieldKey' => 'content', 'value' => 'updated']],
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<p>alpha</p>', $stored);
        $this->assertStringContainsString('<p>updated</p>', $stored);
        $this->assertStringNotContainsString('<p>bravo</p>', $stored);
    }

    // Recovery only fires on a unique match. When the fingerprint matches no
    // block of this type, refuse without writing (no silent corruption).
    public function test_fingerprint_with_no_matching_block_returns_409()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>alpha</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>bravo</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 1,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'no block has this text'],
            'patches'     => [['fieldKey' => 'content', 'value' => 'corrupted']],
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame('block fingerprint mismatch', $res->get_data()['error']);
        $this->assertSame($content, get_post($postId)->post_content);
    }

    // Ambiguous match (two blocks share the fingerprint text) can't be resolved
    // safely — refuse rather than guess.
    public function test_fingerprint_ambiguous_match_returns_409()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>same text</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>same text</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        // blockId 5 is past the end, forcing recovery; fingerprint matches both.
        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 5,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'same text'],
            'patches'     => [['fieldKey' => 'content', 'value' => 'corrupted']],
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame($content, get_post($postId)->post_content);
    }

    // A block-level shortcode render (e.g. [products] -> a <div>) can't nest in
    // a <p>, so the browser splits the paragraph and the live element's text is
    // truncated. The fingerprint is then only a prefix of the stored block;
    // recover to the unique block it prefixes.
    public function test_fingerprint_recovers_via_prefix_when_render_truncates_the_paragraph()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>oane[products]new line</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>another text entirely</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>small</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        // The live element was truncated to "oane"; the stored block is the full
        // "oane[products]new line".
        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 1,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'oane'],
            'rawBlock'    => '<!-- wp:paragraph --><p>oane[products]new line and more</p><!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('oane[products]new line and more', get_post($postId)->post_content);
        $this->assertStringContainsString('<p>small</p>', get_post($postId)->post_content);
    }

    // A truncated (prefix) fingerprint that prefixes two blocks can't be
    // resolved — refuse rather than guess.
    public function test_prefix_match_ambiguous_returns_409()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>oane first variant</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>oane second variant</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 1,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'oane'],
            'patches'     => [['fieldKey' => 'content', 'value' => 'corrupted']],
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame($content, get_post($postId)->post_content);
    }

    // The general fingerprint recovery resolves social-links by their unique
    // `service` attr when the count misses — the same job the old social-link
    // special-case did, now covered by findBlocksByFingerprint.
    public function test_social_link_recovers_by_service_when_count_misses()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:social-links --><ul class="wp-block-social-links">'
                 . '<!-- wp:social-link {"url":"https://fb.com/x","service":"facebook"} /-->'
                 . '<!-- wp:social-link {"url":"https://x.com/y","service":"twitter"} /-->'
                 . '</ul><!-- /wp:social-links -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        // blockId past the end forces a count miss; service identifies the item.
        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 99,
            'blockType'   => 'core/social-link',
            'fingerprint' => ['service' => 'twitter'],
            'patches'     => [['fieldKey' => 'url', 'value' => 'https://x.com/updated']],
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('https://x.com/updated', $stored);
        $this->assertStringContainsString('https://fb.com/x', $stored);
    }

    public function test_matching_fingerprint_allows_save()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>alpha</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>bravo</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 2,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'bravo'],
            'patches'     => [['fieldKey' => 'content', 'value' => 'updated']],
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<p>alpha</p>', $stored);
        $this->assertStringContainsString('<p>updated</p>', $stored);
    }

    // Recovery applies to the rawBlock (text-editor) path too: the count points
    // at the wrong block, the fingerprint identifies the right one, and the
    // whole-block rawBlock lands there.
    public function test_rawBlock_save_recovers_to_matching_block()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>alpha</p><!-- /wp:paragraph -->'
                 . '<!-- wp:paragraph --><p>bravo</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        // blockId 2 counts to "bravo"; the user clicked "alpha".
        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 2,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'alpha'],
            'rawBlock'    => '<!-- wp:paragraph --><p>alpha rewritten</p><!-- /wp:paragraph -->',
        ]));

        $this->assertSame(200, $res->get_status());
        $stored = get_post($postId)->post_content;
        $this->assertStringContainsString('<p>alpha rewritten</p>', $stored);
        $this->assertStringContainsString('<p>bravo</p>', $stored);
        $this->assertStringNotContainsString('<p>alpha</p>', $stored);
    }

    // The client reads a block's text from the rendered DOM, where the_content
    // has run wptexturize (straight apostrophe -> curly). The fingerprint of
    // that rendered text must still match the straight-quote markup the server
    // parses, or every prose block with an apostrophe false-409s. (Field
    // report: editing a paragraph containing "Woody's".)
    public function test_fingerprint_matches_wptexturized_rendered_text()
    {
        $this->loginAsAdmin();
        $content = "<!-- wp:paragraph --><p>Welcome to Woody's shop, the best deals</p><!-- /wp:paragraph -->";
        $postId = self::factory()->post->create(['post_content' => $content]);

        // Mimic the browser: wptexturize emits &#8217; in the HTML, and the
        // client reads the live node's textContent, which decodes it to a
        // curly apostrophe.
        $rendered = apply_filters('the_content', get_post($postId)->post_content);
        $renderedText = trim(html_entity_decode(wp_strip_all_tags($rendered), ENT_QUOTES));
        $this->assertStringContainsString(
            "\u{2019}",
            $renderedText,
            'sanity: wptexturize should have curled the apostrophe in the rendered text'
        );

        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 1,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => $renderedText],
            'patches'     => [['fieldKey' => 'content', 'value' => 'updated']],
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('updated', get_post($postId)->post_content);
    }

    // A shortcode (or any the_content transform) renders to different text than
    // the raw stored markup, so the client's rendered-DOM fingerprint can't
    // match the parsed markup. The gate must render the block the same way the
    // page does and retry before refusing. (Field report: a paragraph with a
    // shortcode became permanently uneditable.)
    public function test_fingerprint_falls_back_to_rendered_text_for_shortcodes()
    {
        $this->loginAsAdmin();
        add_shortcode('ext_fp_probe', static fn () => 'EXPANDED');
        $content = '<!-- wp:paragraph --><p>Hello [ext_fp_probe] world</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        // Client reads "Hello EXPANDED world" from the DOM; raw markup still has
        // the literal "[ext_fp_probe]".
        $res = SaveController::handleSave($this->jsonRequest([
            'source'      => ['kind' => 'post', 'id' => $postId],
            'blockId'     => 1,
            'blockType'   => 'core/paragraph',
            'fingerprint' => ['text' => 'Hello EXPANDED world'],
            'patches'     => [['fieldKey' => 'content', 'value' => 'updated']],
        ]));
        remove_shortcode('ext_fp_probe');

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('updated', get_post($postId)->post_content);
    }

    // The re-render echo sets $GLOBALS['post'] to the source, but in a REST
    // request wp_reset_postdata() can't restore it (the main query has no
    // post), so a template-part save would leave global $post dangling. The
    // save must snapshot and restore it.
    public function test_global_post_is_restored_after_save()
    {
        $this->loginAsAdmin();
        $sentinelId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>sentinel</p><!-- /wp:paragraph -->',
        ]);
        $targetId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->',
        ]);

        $GLOBALS['post'] = get_post($sentinelId);
        $before = $GLOBALS['post'];

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $targetId],
            'blockId'   => 1,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'content', 'value' => 'updated']],
        ]));

        $this->assertSame(200, $res->get_status());
        $after = $GLOBALS['post'] ?? null;
        $this->assertSame($before, $after);
        $this->assertInstanceOf(\WP_Post::class, $after);
        $this->assertSame($sentinelId, $after->ID);
    }

    // --- Translated-content guard ---

    // The corruption hole this closes: a text save with no fingerprint would
    // otherwise pass the count gate and overwrite the source post_content. On a
    // translated render (client-forwarded context) the rawBlock save is refused
    // even without a fingerprint, and nothing is written.
    public function test_rawBlock_text_save_on_translated_render_is_refused_without_fingerprint()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>hola</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'            => ['kind' => 'post', 'id' => $postId],
            'blockId'           => 1,
            'blockType'         => 'core/paragraph',
            'rawBlock'          => '<!-- wp:paragraph --><p>overwritten</p><!-- /wp:paragraph -->',
            'translatedContext' => ['isTranslated' => true, 'plugin' => 'translatepress'],
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame('translated_content', $res->get_data()['error']);
        $this->assertSame($content, get_post($postId)->post_content);
    }

    // Server-side detection is the backstop when the client doesn't forward
    // context: a TranslatePress non-default render (default en_US, current
    // es_ES) refuses the text save on its own.
    public function test_rawBlock_text_save_refused_when_server_detects_translatepress()
    {
        $this->loginAsAdmin();
        update_option('trp_settings', ['default-language' => 'en_US']);
        $GLOBALS['TRP_LANGUAGE'] = 'es_ES';

        $content = '<!-- wp:heading --><h2>hola</h2><!-- /wp:heading -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'    => ['kind' => 'post', 'id' => $postId],
            'blockId'   => 1,
            'blockType' => 'core/heading',
            'rawBlock'  => '<!-- wp:heading --><h2>overwritten</h2><!-- /wp:heading -->',
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame('translated_content', $res->get_data()['error']);
        $this->assertSame($content, get_post($postId)->post_content);
    }

    // The text guard also covers the schema-patch path (content / text fields),
    // not just the rawBlock text editor.
    public function test_content_patch_on_translated_render_is_refused()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>hola</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'            => ['kind' => 'post', 'id' => $postId],
            'blockId'           => 1,
            'blockType'         => 'core/paragraph',
            'patches'           => [['fieldKey' => 'content', 'value' => 'overwritten']],
            'translatedContext' => ['isTranslated' => true, 'plugin' => 'polylang'],
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame($content, get_post($postId)->post_content);
    }

    // Non-text edits stay allowed on a translated render: an alignment patch
    // (shared, untranslated layout) saves normally.
    public function test_alignment_patch_on_translated_render_is_allowed()
    {
        $this->loginAsAdmin();
        $content = '<!-- wp:paragraph --><p>hola</p><!-- /wp:paragraph -->';
        $postId = self::factory()->post->create(['post_content' => $content]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'            => ['kind' => 'post', 'id' => $postId],
            'blockId'           => 1,
            'blockType'         => 'core/paragraph',
            'patches'           => [['fieldKey' => 'align', 'value' => 'center']],
            'translatedContext' => ['isTranslated' => true, 'plugin' => 'translatepress'],
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString(
            'has-text-align-center',
            get_post($postId)->post_content
        );
    }

    // Default-language renders are unaffected: a text save with the context
    // flagged not-translated proceeds and writes.
    public function test_text_save_on_default_language_is_allowed()
    {
        $this->loginAsAdmin();
        $postId = self::factory()->post->create([
            'post_content' => '<!-- wp:paragraph --><p>old</p><!-- /wp:paragraph -->',
        ]);

        $res = SaveController::handleSave($this->jsonRequest([
            'source'            => ['kind' => 'post', 'id' => $postId],
            'blockId'           => 1,
            'blockType'         => 'core/paragraph',
            'rawBlock'          => '<!-- wp:paragraph --><p>new</p><!-- /wp:paragraph -->',
            'translatedContext' => ['isTranslated' => false, 'plugin' => null],
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('<p>new</p>', get_post($postId)->post_content);
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
