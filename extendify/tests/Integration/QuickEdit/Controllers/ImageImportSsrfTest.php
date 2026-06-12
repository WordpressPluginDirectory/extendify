<?php

namespace Extendify\Tests\Integration\QuickEdit\Controllers;

use Extendify\Draft\Controllers\ImageController;
use WP_UnitTestCase;

/**
 * SSRF guard for QuickEdit's only server-side image fetch.
 *
 * QuickEdit's AI-image + Unsplash pickers (src/QuickEdit/components/modals/*) import
 * a chosen image via importImageServer()/downloadImage() (src/Shared/api/wp.js) →
 * POST /extendify/v1/draft/upload-image → ImageController::uploadMedia(), which hands
 * the client-supplied `source` URL to WordPress core media_sideload_image().
 *
 * The SSRF defense lives in core: media_sideload_image() → download_url() →
 * wp_safe_remote_get(), which runs the URL through wp_http_validate_url() and rejects
 * loopback / private / link-local targets before any socket opens. Our code's
 * contribution — and what these pins guard against regressing — is routing the import
 * through that safe path rather than a raw wp_remote_get($source). The four other
 * QuickEdit write surfaces never fetch a URL (WCProduct/SiteIdentity take attachment
 * IDs; Save/WPNav/WPForms write post_content), so this is the whole server-fetch surface.
 */
class ImageImportSsrfTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }

    /**
     * Adversarial: internal / loopback / link-local source URLs are refused by the
     * safe-fetch path before any request leaves the box — cloud-metadata exfil,
     * loopback port-probe, RFC1918 reach all fail.
     */
    public function test_internal_target_urls_are_rejected_by_the_safe_fetch_path()
    {
        $internal = [
            'http://169.254.169.254/latest/meta-data/x.png', // cloud metadata
            'http://127.0.0.1/x.png',                        // loopback
            'http://localhost/x.png',
            'http://10.0.0.1/x.png',                         // RFC1918
            'http://192.168.1.1/x.png',
        ];

        foreach ($internal as $url) {
            $this->assertWPError(
                download_url($url),
                "Expected the safe-fetch path to refuse internal target {$url}"
            );
        }
    }

    /**
     * The import fetch goes through the SSRF-safe path: the outbound request for the
     * source URL carries reject_unsafe_urls=true, which only wp_safe_remote_get() sets
     * (download_url() uses it). A regression to a raw wp_remote_get($source) would drop
     * the flag and reopen SSRF.
     *
     * Mutation-verified: replacing media_sideload_image() in uploadMedia() with a direct
     * wp_remote_get($source)+wp_upload_bits() drops reject_unsafe_urls and turns this red.
     */
    public function test_upload_fetches_source_through_the_unsafe_url_rejecting_path()
    {
        $captured = [];
        add_filter('http_request_args', function ($args, $url) use (&$captured) {
            $captured[$url] = $args;
            return $args;
        }, 10, 2);

        // Short-circuit the network: write valid PNG bytes to download_url()'s stream
        // target so the sideload completes without a real socket, then report 200.
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        );
        add_filter('pre_http_request', function ($pre, $args, $url) use ($png) {
            if (!empty($args['filename'])) {
                file_put_contents($args['filename'], $png);
            }
            return [
                'headers'  => [],
                'body'     => '',
                'response' => ['code' => 200, 'message' => 'OK'],
                'cookies'  => [],
                'filename' => $args['filename'] ?? null,
            ];
        }, 10, 3);

        $src = 'https://images.unsplash.com/photo-ssrf-pin.png';
        $req = new \WP_REST_Request('POST', '/extendify/v1/draft/upload-image');
        $req->set_param('source', $src);

        $res = ImageController::uploadMedia($req);
        $id = $res->get_data()['id'];

        $this->assertIsInt($id);
        $this->assertGreaterThan(0, $id, 'media_sideload_image() should create an attachment');
        $this->assertArrayHasKey($src, $captured, 'the client source URL was fetched');
        $this->assertTrue(
            (bool) $captured[$src]['reject_unsafe_urls'],
            'the source fetch must use the SSRF-safe (reject_unsafe_urls) path'
        );
    }
}
