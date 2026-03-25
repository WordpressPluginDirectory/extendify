<?php

namespace Extendify\Tests\Integration\Agent\Controllers;

use Extendify\Agent\Controllers\WPController;
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
}
