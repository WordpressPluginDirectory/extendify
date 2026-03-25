<?php

namespace Extendify\Tests\Integration;

use Extendify\Shared\Services\Import\Post;
use WP_UnitTestCase;

class CronTest extends WP_UnitTestCase
{
    public function test_cron_executes()
    {
        $isLocked = false;
        $cronUserId = null;
        $user = self::factory()->user->create();
        wp_set_current_user($user);
        $postId = self::factory()->post->create(['post_content' => '<p>original</p>']);
        wp_set_post_lock($postId);

        // Cron runs as no user, so we need to reset the current user to 0 to simulate that.
        wp_set_current_user(0);
        add_action('my_cron_hook', function () use ($postId, &$isLocked, &$cronUserId) {
            $isLocked = wp_check_post_lock($postId);
            $cronUserId = get_current_user_id();
        });

        wp_schedule_single_event(time() - 10, 'my_cron_hook');

        $crons = _get_cron_array();
        foreach ($crons as $timestamp => $hooks) {
            if ($timestamp > time()) continue;

            foreach ($hooks as $hook => $events) {
                foreach ($events as $event) {
                    do_action_ref_array($hook, $event['args']);
                }
            }
        }

        $this->assertTrue(Post::isLocked($postId));
        $this->assertNotFalse(wp_check_post_lock($postId));
        $this->assertNotNull($postId);
        $this->assertIsNumeric($isLocked);
        $this->assertSame($user, $isLocked);
        $this->assertSame(0, $cronUserId);
    }
}
