<?php

namespace Extendify\Tests\Integration\QuickEdit\Controllers;

use Extendify\QuickEdit\Controllers\WCProductController;
use WP_UnitTestCase;

class WCProductControllerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
    }

    public function test_permission_callback_requires_admin_capability()
    {
        wp_set_current_user(0);
        $this->assertFalse(WCProductController::permissionCallback());

        $sub = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($sub);
        $this->assertFalse(WCProductController::permissionCallback());

        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $this->assertFalse(WCProductController::permissionCallback());

        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
        $this->assertTrue(WCProductController::permissionCallback());
    }

    public function test_get_without_product_id_returns_400()
    {
        $res = WCProductController::handle($this->getRequest([]));
        $this->assertSame(400, $res->get_status());
        $this->assertSame('product_id required', $res->get_data()['error']);
    }

    public function test_get_with_non_product_post_returns_400()
    {
        $postId = self::factory()->post->create();

        $res = WCProductController::handle($this->getRequest(['product_id' => $postId]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('not a product', $res->get_data()['error']);
    }

    public function test_get_returns_name_short_description_prices_and_image_meta()
    {
        $pid = $this->createProduct([
            'post_title'   => 'Hat',
            'post_excerpt' => 'A summary',
            'post_content' => 'The long description.',
        ]);
        $product = wc_get_product($pid);
        $product->set_regular_price('20');
        $product->set_sale_price('15');
        $product->save();

        $res = WCProductController::handle($this->getRequest(['product_id' => $pid]));

        $this->assertSame(200, $res->get_status());
        $data = $res->get_data();
        $this->assertSame('Hat', $data['name']);
        $this->assertSame('A summary', $data['short_description']);
        $this->assertSame('The long description.', $data['description']);
        $this->assertSame('20', $data['regular_price']);
        $this->assertSame('15', $data['sale_price']);
        $this->assertSame(0, $data['image_id']);
        $this->assertSame('', $data['image_url']);
    }

    public function test_post_updates_name()
    {
        $pid = $this->createProduct(['post_title' => 'Old']);

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'name',
            'value'      => 'New title',
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertTrue($res->get_data()['ok']);
        $this->assertSame('New title', get_post($pid)->post_title);
    }

    public function test_post_name_sanitizes_html()
    {
        $pid = $this->createProduct();

        WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'name',
            'value'      => '<script>x</script>Clean',
        ]));

        $this->assertSame('Clean', get_post($pid)->post_title);
    }

    public function test_post_updates_short_description()
    {
        $pid = $this->createProduct(['post_excerpt' => 'old']);

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'short_description',
            'value'      => '<p>A <strong>rich</strong> excerpt</p>',
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('<strong>rich</strong>', get_post($pid)->post_excerpt);
    }

    public function test_post_updates_description()
    {
        $pid = $this->createProduct(['post_content' => 'old long description']);

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'description',
            'value'      => '<p>A <strong>rich</strong> long description</p>',
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertStringContainsString('<strong>rich</strong>', get_post($pid)->post_content);
    }

    public function test_post_description_sanitizes_disallowed_html()
    {
        $pid = $this->createProduct();

        WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'description',
            'value'      => '<p>safe</p><script>x</script>',
        ]));

        $this->assertStringNotContainsString('<script', get_post($pid)->post_content);
        $this->assertStringContainsString('<p>safe</p>', get_post($pid)->post_content);
    }

    public function test_post_price_requires_object_value()
    {
        $pid = $this->createProduct();

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'price',
            'value'      => '10',
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('price expects {regular, sale}', $res->get_data()['error']);
    }

    public function test_post_price_sets_regular_and_sale_and_displays_lower()
    {
        $pid = $this->createProduct();

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'price',
            'value'      => ['regular' => '50', 'sale' => '30'],
        ]));

        $this->assertSame(200, $res->get_status());
        $product = wc_get_product($pid);
        $this->assertSame('50', $product->get_regular_price());
        $this->assertSame('30', $product->get_sale_price());
        // _price tracks the displayed price; 30 < 50 ⇒ sale wins.
        $this->assertSame('30', $product->get_price());
    }

    public function test_post_price_with_empty_sale_uses_regular_for_displayed()
    {
        $pid = $this->createProduct();

        WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'price',
            'value'      => ['regular' => '40', 'sale' => ''],
        ]));

        $product = wc_get_product($pid);
        $this->assertSame('40', $product->get_regular_price());
        $this->assertSame('', $product->get_sale_price());
        $this->assertSame('40', $product->get_price());
    }

    public function test_post_image_requires_positive_attachment_id()
    {
        $pid = $this->createProduct();

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'image',
            'value'      => 0,
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('attachment_id required', $res->get_data()['error']);
    }

    public function test_post_image_calls_set_post_thumbnail_and_returns_ok()
    {
        $pid = $this->createProduct();
        // wp_get_attachment_image (set_post_thumbnail's pre-check) needs a real
        // attached file. create_upload_object writes a stub PNG to uploads.
        $attId = self::factory()->attachment->create_upload_object(
            $this->writeStubPng()
        );

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'image',
            'value'      => $attId,
        ]));

        $this->assertSame(200, $res->get_status());
        $this->assertSame($attId, (int) get_post_thumbnail_id($pid));
    }

    public function test_post_image_rejects_nonexistent_attachment_id()
    {
        $pid = $this->createProduct();

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'image',
            'value'      => 999999,
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('not an image attachment', $res->get_data()['error']);
        $this->assertSame(0, (int) get_post_thumbnail_id($pid));
    }

    public function test_post_image_rejects_non_image_attachment()
    {
        $pid   = $this->createProduct();
        $attId = self::factory()->attachment->create_upload_object($this->writeStubText());

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'image',
            'value'      => $attId,
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('not an image attachment', $res->get_data()['error']);
        $this->assertSame(0, (int) get_post_thumbnail_id($pid));
    }

    public function test_post_unknown_field_returns_400()
    {
        $pid = $this->createProduct();

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'bogus',
            'value'      => 'x',
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertStringStartsWith('unknown field', $res->get_data()['error']);
    }

    public function test_post_forbidden_when_user_cannot_edit_post()
    {
        $pid = $this->createProduct();
        $sub = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($sub);

        $res = WCProductController::handle($this->postRequest([
            'product_id' => $pid,
            'field'      => 'name',
            'value'      => 'x',
        ]));

        $this->assertSame(403, $res->get_status());
        $this->assertSame('cannot edit this product', $res->get_data()['error']);
    }

    public function test_init_hooks_registerRoutes_into_rest_api_init()
    {
        remove_all_filters('rest_api_init');
        WCProductController::init();

        $this->assertNotFalse(
            has_action('rest_api_init', [WCProductController::class, 'registerRoutes'])
        );
    }

    private function createProduct(array $args = []): int
    {
        return self::factory()->post->create(array_merge([
            'post_type'   => 'product',
            'post_title'  => 'Test Product',
            'post_status' => 'publish',
        ], $args));
    }

    private function getRequest(array $params): \WP_REST_Request
    {
        $req = new \WP_REST_Request('GET', '/extendify/v1/quick-edit/product');
        foreach ($params as $k => $v) {
            $req->set_param($k, $v);
        }
        return $req;
    }

    private function postRequest(array $params): \WP_REST_Request
    {
        $req = new \WP_REST_Request('POST', '/extendify/v1/quick-edit/product');
        foreach ($params as $k => $v) {
            $req->set_param($k, $v);
        }
        return $req;
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }

    private function writeStubPng(): string
    {
        // 1×1 transparent PNG, base64-decoded.
        $bytes = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        );
        $path = wp_tempnam('qe-test-stub') . '.png';
        file_put_contents($path, $bytes);
        return $path;
    }

    private function writeStubText(): string
    {
        // A real, non-image upload: the attachment exists but isn't an image.
        $path = wp_tempnam('qe-test-stub') . '.txt';
        file_put_contents($path, 'not an image');
        return $path;
    }
}
