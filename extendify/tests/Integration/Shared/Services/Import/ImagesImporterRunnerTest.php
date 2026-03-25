<?php

namespace Extendify\Tests\Integration\Shared\Services\Import;

use Extendify\Shared\Services\Import\ImagesImporterRunner;
use Extendify\Shared\Services\Import\Post;
use WP_UnitTestCase;

/**
 * Tests for ImagesImporterRunner focusing on lock functionality.
 *
 * These tests verify that the runner correctly respects post-locks
 * and does not process images when a post is locked.
 */
class ImagesImporterRunnerTest extends WP_UnitTestCase
{
    public function test_cant_update_post_when_locked_by_cron_user()
    {
        $originalContent = '<p class="extendify-image-import">Content</p>';
        $postId = self::factory()->post->create([
            'post_content' => $originalContent,
        ]);

        update_option('extendify_check_for_image_imports', true);

        // Create a user and lock the post.
        $user = self::factory()->user->create();
        wp_set_current_user($user);
        wp_set_post_lock($postId);

        // Run the importer as the cron user (no user).
        wp_set_current_user(0);
        $runner = new ImagesImporterRunner();

        $this->assertNull($runner->run());
        $this->assertTrue(Post::isLocked($postId));
        $this->assertSame($originalContent, get_post($postId)->post_content);
        $this->assertNotEmpty(get_transient('extendify_import_images_check_delay'));
    }

    public function test_delay_processing_sets_transient()
    {
        $runner = new ImagesImporterRunner();
        $runner->delayProcessing(300);

        $this->assertNotEmpty(get_transient('extendify_import_images_check_delay'));
    }

    public function test_run_returns_early_when_delay_transient_is_set()
    {
        $originalContent = '<p class="extendify-image-import">Content</p>';
        $postId = self::factory()->post->create([
            'post_content' => $originalContent,
        ]);

        update_option('extendify_check_for_image_imports', true);
        set_transient('extendify_import_images_check_delay', time(), HOUR_IN_SECONDS);

        $runner = new ImagesImporterRunner();

        $this->assertNull($runner->run());
        $this->assertSame($originalContent, get_post($postId)->post_content);
    }

    /**
     * @see https://developer.wordpress.org/reference/hooks/upload_dir/
     */
    public function test_run_returns_early_when_upload_dir_has_error()
    {
        $originalContent = '<p class="extendify-image-import">Content</p>';
        $postId = self::factory()->post->create([
            'post_content' => $originalContent,
        ]);

        update_option('extendify_check_for_image_imports', true);

        add_filter('upload_dir', function ($dir) {
            $dir['error'] = 'Upload directory is not writable.';
            return $dir;
        });

        $runner = new ImagesImporterRunner();

        $this->assertNull($runner->run());
        $this->assertSame($originalContent, get_post($postId)->post_content);
    }

    public function test_run_returns_early_when_check_for_image_imports_option_not_set()
    {
        $originalContent = '<p class="extendify-image-import">Content</p>';
        $postId = self::factory()->post->create([
            'post_content' => $originalContent,
        ]);

        $runner = new ImagesImporterRunner();

        $this->assertNull($runner->run());
        $this->assertSame($originalContent, get_post($postId)->post_content);
    }
}
