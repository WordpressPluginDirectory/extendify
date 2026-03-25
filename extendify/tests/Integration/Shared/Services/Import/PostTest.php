<?php

namespace Extendify\Tests\Integration\Shared\Services\Import;

use Extendify\Shared\Services\Import\Post;
use WP_UnitTestCase;

class PostTest extends WP_UnitTestCase
{
    public function test_is_locked_returns_true_when_lock_is_fresh()
    {
        $postId = self::factory()->post->create();
        update_post_meta($postId, '_edit_lock', time() . ':1');

        $this->assertTrue(Post::isLocked($postId));
    }

    public function test_is_locked_returns_false_when_lock_is_expired()
    {
        $postId = self::factory()->post->create();
        // Set a lock that expired 200s ago (window is 150s).
        update_post_meta($postId, '_edit_lock', (time() - 200) . ':1');

        $this->assertFalse(Post::isLocked($postId));
    }

    public function test_is_locked_returns_false_when_no_lock()
    {
        $postId = self::factory()->post->create();

        $this->assertFalse(Post::isLocked($postId));
    }
}
