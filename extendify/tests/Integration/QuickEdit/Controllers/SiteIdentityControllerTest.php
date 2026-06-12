<?php

namespace Extendify\Tests\Integration\QuickEdit\Controllers;

use Extendify\QuickEdit\Controllers\SiteIdentityController;
use WP_UnitTestCase;

class SiteIdentityControllerTest extends WP_UnitTestCase
{
    public function test_permission_callback_requires_manage_options()
    {
        wp_set_current_user(0);
        $this->assertFalse(SiteIdentityController::permissionCallback());

        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $this->assertFalse(SiteIdentityController::permissionCallback());

        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
        $this->assertTrue(SiteIdentityController::permissionCallback());
    }

    public function test_get_returns_title_tagline_logo_id_and_url()
    {
        update_option('blogname', 'My Site');
        update_option('blogdescription', 'Tagline & co');
        delete_option('site_logo');

        $res = SiteIdentityController::handle($this->getRequest());

        $this->assertSame(200, $res->get_status());
        $data = $res->get_data();
        $this->assertSame('My Site', $data['title']);
        // WP escapes & to &amp; on store; controller decodes on read.
        $this->assertSame('Tagline & co', $data['tagline']);
        $this->assertSame(0, $data['logo_id']);
        $this->assertSame('', $data['logo_url']);
    }

    public function test_get_returns_decoded_entities_so_react_input_doesnt_show_them()
    {
        // wp_specialchars_decode round-trip: WP stores &#039; for apostrophe.
        update_option('blogname', "Brand's site");

        $res = SiteIdentityController::handle($this->getRequest());

        $this->assertSame("Brand's site", $res->get_data()['title']);
    }

    public function test_get_returns_logo_id_when_site_logo_set_even_without_attachment_url()
    {
        // No real attachment file — just an ID. Controller still returns the id
        // and an empty url string (wp_get_attachment_image_url returns false).
        update_option('site_logo', 12345);

        $res = SiteIdentityController::handle($this->getRequest());

        $data = $res->get_data();
        $this->assertSame(12345, $data['logo_id']);
        $this->assertSame('', $data['logo_url']);
    }

    public function test_post_updates_blogname()
    {
        $res = SiteIdentityController::handle($this->postRequest(['title' => 'New Name']));

        $this->assertSame(200, $res->get_status());
        $this->assertTrue($res->get_data()['ok']);
        $this->assertSame('New Name', get_option('blogname'));
    }

    public function test_post_updates_tagline()
    {
        $res = SiteIdentityController::handle($this->postRequest(['tagline' => 'New tagline']));

        $this->assertSame(200, $res->get_status());
        $this->assertSame('New tagline', get_option('blogdescription'));
    }

    public function test_post_sanitizes_title_strips_html()
    {
        $res = SiteIdentityController::handle($this->postRequest([
            'title' => '<script>alert(1)</script>Clean',
        ]));

        $this->assertSame(200, $res->get_status());
        // sanitize_text_field strips tags.
        $this->assertSame('Clean', get_option('blogname'));
    }

    public function test_post_with_logo_id_zero_deletes_site_logo()
    {
        update_option('site_logo', 999);

        $res = SiteIdentityController::handle($this->postRequest(['logo_id' => 0]));

        $this->assertSame(200, $res->get_status());
        $this->assertFalse(get_option('site_logo'));
    }

    public function test_post_with_logo_id_nonzero_sets_site_logo()
    {
        delete_option('site_logo');

        $res = SiteIdentityController::handle($this->postRequest(['logo_id' => 42]));

        $this->assertSame(200, $res->get_status());
        $this->assertSame('42', (string) get_option('site_logo'));
    }

    public function test_post_with_missing_logo_id_key_leaves_existing_logo_intact()
    {
        update_option('site_logo', 77);

        $res = SiteIdentityController::handle($this->postRequest(['title' => 'X']));

        $this->assertSame(200, $res->get_status());
        $this->assertSame('77', (string) get_option('site_logo'));
    }

    public function test_post_with_no_known_keys_returns_ok_without_changing_options()
    {
        update_option('blogname', 'Untouched');
        update_option('blogdescription', 'Same');

        $res = SiteIdentityController::handle($this->postRequest(['junk' => 'value']));

        $this->assertSame(200, $res->get_status());
        $this->assertSame('Untouched', get_option('blogname'));
        $this->assertSame('Same', get_option('blogdescription'));
    }

    public function test_round_trip_get_post_get()
    {
        SiteIdentityController::handle($this->postRequest([
            'title'   => 'After',
            'tagline' => 'Tag',
        ]));

        $res = SiteIdentityController::handle($this->getRequest());

        $data = $res->get_data();
        $this->assertSame('After', $data['title']);
        $this->assertSame('Tag', $data['tagline']);
    }

    public function test_init_hooks_registerRoutes_into_rest_api_init()
    {
        remove_all_filters('rest_api_init');
        SiteIdentityController::init();

        $this->assertNotFalse(
            has_action('rest_api_init', [SiteIdentityController::class, 'registerRoutes'])
        );
    }

    private function getRequest(): \WP_REST_Request
    {
        $req = new \WP_REST_Request('GET', '/extendify/v1/quick-edit/site-identity');
        return $req;
    }

    private function postRequest(array $body): \WP_REST_Request
    {
        $req = new \WP_REST_Request('POST', '/extendify/v1/quick-edit/site-identity');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode($body));
        return $req;
    }
}
