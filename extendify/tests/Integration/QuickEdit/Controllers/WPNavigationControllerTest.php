<?php

namespace Extendify\Tests\Integration\QuickEdit\Controllers;

use Extendify\QuickEdit\Controllers\WPNavigationController;
use Extendify\QuickEdit\Schemas\Registry;
use ReflectionClass;
use WP_UnitTestCase;

class WPNavigationControllerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->resetRegistry();
        Registry::init();
        $this->loginAsAdmin();
    }

    public function tearDown(): void
    {
        $this->resetRegistry();
        parent::tearDown();
    }

    public function test_permission_callback_requires_admin_capability()
    {
        wp_set_current_user(0);
        $this->assertFalse(WPNavigationController::permissionCallback());

        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $this->assertFalse(WPNavigationController::permissionCallback());

        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
        $this->assertTrue(WPNavigationController::permissionCallback());
    }

    public function test_missing_required_fields_returns_400()
    {
        $res = WPNavigationController::handle($this->jsonRequest([]));
        $this->assertSame(400, $res->get_status());
        $this->assertStringContainsString('required', $res->get_data()['error']);
    }

    public function test_unsupported_blockType_returns_400()
    {
        $navId = $this->createNav('<!-- wp:navigation-link {"label":"Home","url":"/"} /-->');

        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 0,
            'blockType' => 'core/paragraph',
            'patches'   => [['fieldKey' => 'label', 'value' => 'X']],
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('unsupported blockType for wp-navigation save', $res->get_data()['error']);
    }

    public function test_non_wp_navigation_post_returns_404()
    {
        $postId = self::factory()->post->create();

        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $postId,
            'itemIndex' => 0,
            'blockType' => 'core/navigation-link',
            'patches'   => [['fieldKey' => 'label', 'value' => 'X']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('wp_navigation post not found', $res->get_data()['error']);
    }

    public function test_subscriber_user_forbidden()
    {
        $navId = $this->createNav('<!-- wp:navigation-link {"label":"Home","url":"/"} /-->');
        $sub = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($sub);

        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 0,
            'blockType' => 'core/navigation-link',
            'patches'   => [['fieldKey' => 'label', 'value' => 'X']],
        ]));

        $this->assertSame(403, $res->get_status());
    }

    public function test_itemIndex_past_end_returns_404()
    {
        $navId = $this->createNav('<!-- wp:navigation-link {"label":"Home","url":"/"} /-->');

        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 5,
            'blockType' => 'core/navigation-link',
            'patches'   => [['fieldKey' => 'label', 'value' => 'X']],
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('nav item not found at index', $res->get_data()['error']);
        $this->assertSame(5, $res->get_data()['itemIndex']);
    }

    public function test_blockType_mismatch_returns_409()
    {
        $navId = $this->createNav('<!-- wp:navigation-link {"label":"Home","url":"/"} /-->');

        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 0,
            'blockType' => 'core/navigation-submenu',
            'patches'   => [['fieldKey' => 'label', 'value' => 'X']],
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame('core/navigation-submenu', $res->get_data()['expected']);
        $this->assertSame('core/navigation-link', $res->get_data()['actual']);
    }

    public function test_updates_label_via_index_0()
    {
        $navId = $this->createNav('<!-- wp:navigation-link {"label":"Home","url":"/"} /-->');

        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 0,
            'blockType' => 'core/navigation-link',
            'patches'   => [['fieldKey' => 'label', 'value' => 'Homepage']],
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertTrue($res->get_data()['ok']);

        $blocks = parse_blocks(get_post($navId)->post_content);
        $this->assertSame('Homepage', $blocks[0]['attrs']['label']);
    }

    public function test_updates_url_via_index()
    {
        $navId = $this->createNav('<!-- wp:navigation-link {"label":"Home","url":"/"} /-->');

        WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 0,
            'blockType' => 'core/navigation-link',
            'patches'   => [['fieldKey' => 'url', 'value' => 'https://example.com/about']],
        ]));

        $blocks = parse_blocks(get_post($navId)->post_content);
        $this->assertSame('https://example.com/about', $blocks[0]['attrs']['url']);
    }

    public function test_index_counts_only_nav_link_and_nav_submenu()
    {
        // Three nav items. Submenu wrapping nested links shouldn't double-count.
        $content = '<!-- wp:navigation-link {"label":"One","url":"/1"} /-->'
                 . '<!-- wp:navigation-submenu {"label":"Two","url":"/2"} -->'
                 .   '<!-- wp:navigation-link {"label":"Two-A","url":"/2a"} /-->'
                 . '<!-- /wp:navigation-submenu -->'
                 . '<!-- wp:navigation-link {"label":"Three","url":"/3"} /-->';
        $navId = $this->createNav($content);

        // index 0 = One, 1 = Two (submenu), 2 = Two-A (nested), 3 = Three.
        WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 3,
            'blockType' => 'core/navigation-link',
            'patches'   => [['fieldKey' => 'label', 'value' => 'Last']],
        ]));

        $blocks = parse_blocks(get_post($navId)->post_content);
        $this->assertSame('Last', $blocks[2]['attrs']['label']);
        // Earlier items untouched.
        $this->assertSame('One', $blocks[0]['attrs']['label']);
        $this->assertSame('Two', $blocks[1]['attrs']['label']);
        $this->assertSame('Two-A', $blocks[1]['innerBlocks'][0]['attrs']['label']);
    }

    public function test_save_to_index_3_after_deleting_item_at_index_1_targets_a_different_item()
    {
        // Characterize the index semantics: indices are positional. If items
        // are reordered/deleted between client read and save, the index will
        // address a different item — the controller doesn't reconcile.
        $base = '<!-- wp:navigation-link {"label":"A","url":"/a"} /-->'
              . '<!-- wp:navigation-link {"label":"B","url":"/b"} /-->'
              . '<!-- wp:navigation-link {"label":"C","url":"/c"} /-->';
        $navId = $this->createNav($base);

        // Delete B (originally at index 1) externally.
        $shortened = '<!-- wp:navigation-link {"label":"A","url":"/a"} /-->'
                   . '<!-- wp:navigation-link {"label":"C","url":"/c"} /-->';
        wp_update_post([
            'ID'           => $navId,
            'post_content' => wp_slash($shortened),
        ]);

        // Client thinks "edit C at index 2"; after deletion, index 2 doesn't exist.
        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId' => $navId,
            'itemIndex' => 2,
            'blockType' => 'core/navigation-link',
            'patches'   => [['fieldKey' => 'label', 'value' => 'C-renamed']],
        ]));

        $this->assertSame(404, $res->get_status());
    }

    // Submenu/ordering divergence can resolve a nav-item index to the
    // wrong same-type sibling. The fingerprint of the clicked item's label is
    // the safety net: a mismatch refuses instead of editing the wrong link.
    public function test_fingerprint_mismatch_returns_409_without_writing()
    {
        $content = '<!-- wp:navigation-link {"label":"A","url":"/a"} /-->'
                 . '<!-- wp:navigation-link {"label":"B","url":"/b"} /-->';
        $navId = $this->createNav($content);

        // index 1 counts to "B"; client meant "A".
        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId'   => $navId,
            'itemIndex'   => 1,
            'blockType'   => 'core/navigation-link',
            'fingerprint' => ['text' => 'A'],
            'patches'     => [['fieldKey' => 'label', 'value' => 'corrupted']],
        ]));

        $this->assertSame(409, $res->get_status());
        $this->assertSame('block fingerprint mismatch', $res->get_data()['error']);
        $blocks = parse_blocks(get_post($navId)->post_content);
        $this->assertSame('B', $blocks[1]['attrs']['label']);
    }

    public function test_matching_fingerprint_allows_save()
    {
        $content = '<!-- wp:navigation-link {"label":"A","url":"/a"} /-->'
                 . '<!-- wp:navigation-link {"label":"B","url":"/b"} /-->';
        $navId = $this->createNav($content);

        $res = WPNavigationController::handle($this->jsonRequest([
            'navPostId'   => $navId,
            'itemIndex'   => 1,
            'blockType'   => 'core/navigation-link',
            'fingerprint' => ['text' => 'B'],
            'patches'     => [['fieldKey' => 'label', 'value' => 'Beta']],
        ]));

        $this->assertSame(200, $res->get_status());
        $blocks = parse_blocks(get_post($navId)->post_content);
        $this->assertSame('Beta', $blocks[1]['attrs']['label']);
    }

    public function test_init_hooks_registerRoutes_into_rest_api_init()
    {
        remove_all_filters('rest_api_init');
        WPNavigationController::init();

        $this->assertNotFalse(
            has_action('rest_api_init', [WPNavigationController::class, 'registerRoutes'])
        );
    }

    private function createNav(string $content): int
    {
        return self::factory()->post->create([
            'post_type'    => 'wp_navigation',
            'post_status'  => 'publish',
            'post_content' => wp_slash($content),
        ]);
    }

    private function jsonRequest(array $body): \WP_REST_Request
    {
        $req = new \WP_REST_Request('POST', '/extendify/v1/quick-edit/wp-navigation');
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
