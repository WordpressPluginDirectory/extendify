<?php

namespace Extendify\Tests\Integration\Toolbar;

use Extendify\Toolbar\Admin;
use Extendify\Toolbar\Frontend;
use WP_UnitTestCase;

/**
 * Characterizes the user-profile "Toolbar Style" row + persistence
 * + the print-footer reorder script.
 *
 * Findings pinned (versus what someone might assume from product
 * framing):
 *
 *  - The Simple/Full radios use the literal user-meta key
 *    `extendify_toolbar_style` (Frontend::STYLE_META). Any rename
 *    breaks compatibility for users who already saved a choice.
 *  - saveProfileRow defaults to 'simple' when no POST value comes
 *    through — not to the Launch-aware default. Once a user posts
 *    their profile, the launchCompleted-driven default is gone for
 *    them forever (the stored 'simple' overrides anything dynamic).
 *  - reorderRow inserts our row AFTER the core
 *    `user-admin-bar-front-wrap` row, not before — the script reads
 *    `anchor.nextSibling` and uses `insertBefore` against it.
 */
class AdminTest extends WP_UnitTestCase
{
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        if (!defined('EXTENDIFY_REQUIRED_CAPABILITY')) {
            define('EXTENDIFY_REQUIRED_CAPABILITY', 'manage_options');
        }
    }

    public function tearDown(): void
    {
        remove_all_actions('personal_options');
        remove_all_actions('personal_options_update');
        remove_all_actions('edit_user_profile_update');
        remove_all_actions('admin_print_footer_scripts-profile.php');
        remove_all_actions('admin_print_footer_scripts-user-edit.php');
        parent::tearDown();
    }

    public function test_constructor_hooks_all_five_actions()
    {
        $admin = new Admin();

        $this->assertNotFalse(has_action('personal_options', [$admin, 'renderProfileRow']));
        $this->assertNotFalse(has_action('personal_options_update', [$admin, 'saveProfileRow']));
        $this->assertNotFalse(has_action('edit_user_profile_update', [$admin, 'saveProfileRow']));
        $this->assertNotFalse(has_action('admin_print_footer_scripts-profile.php', [$admin, 'reorderRow']));
        $this->assertNotFalse(has_action('admin_print_footer_scripts-user-edit.php', [$admin, 'reorderRow']));
    }

    public function test_render_profile_row_marks_simple_radio_checked_when_user_meta_is_simple()
    {
        $userId = self::factory()->user->create(['role' => 'administrator']);
        update_user_meta($userId, Frontend::STYLE_META, 'simple');
        $user = get_user_by('id', $userId);

        $html = $this->capture(fn () => (new Admin())->renderProfileRow($user));

        $this->assertStringContainsString('class="extendify-toolbar-style-wrap"', $html);
        $this->assertStringContainsString('Toolbar Style', $html);
        $this->assertMatchesRegularExpression(
            "/value=\"simple\"[^>]*checked='checked'/",
            $html,
            'Simple radio should be checked when the user meta is simple.'
        );
        $this->assertDoesNotMatchRegularExpression(
            "/value=\"full\"[^>]*checked='checked'/",
            $html,
            'Full radio must not be checked when the user picked simple.'
        );
    }

    public function test_render_profile_row_marks_full_radio_checked_when_user_meta_is_full()
    {
        $userId = self::factory()->user->create(['role' => 'administrator']);
        update_user_meta($userId, Frontend::STYLE_META, 'full');
        $user = get_user_by('id', $userId);

        $html = $this->capture(fn () => (new Admin())->renderProfileRow($user));

        $this->assertMatchesRegularExpression("/value=\"full\"[^>]*checked='checked'/", $html);
        $this->assertDoesNotMatchRegularExpression("/value=\"simple\"[^>]*checked='checked'/", $html);
    }

    public function test_render_profile_row_uses_launch_aware_default_when_meta_unset()
    {
        update_option('extendify_onboarding_completed', false);
        \Extendify\Config::$launchCompleted = false;

        $userId = self::factory()->user->create(['role' => 'administrator']);
        delete_user_meta($userId, Frontend::STYLE_META);
        $user = get_user_by('id', $userId);

        $html = $this->capture(fn () => (new Admin())->renderProfileRow($user));

        $this->assertMatchesRegularExpression("/value=\"full\"[^>]*checked='checked'/", $html);
        $this->assertDoesNotMatchRegularExpression("/value=\"simple\"[^>]*checked='checked'/", $html);
    }

    public function test_render_profile_row_uses_meta_key_extendify_toolbar_style()
    {
        $userId = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $userId);

        $html = $this->capture(fn () => (new Admin())->renderProfileRow($user));

        $this->assertStringContainsString('name="extendify_toolbar_style"', $html);
        $this->assertSame(Frontend::STYLE_META, 'extendify_toolbar_style');
    }

    public function test_save_profile_row_persists_simple()
    {
        $userId = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($userId);
        $_POST[Frontend::STYLE_META] = 'simple';

        (new Admin())->saveProfileRow($userId);

        $this->assertSame('simple', get_user_meta($userId, Frontend::STYLE_META, true));
        unset($_POST[Frontend::STYLE_META]);
    }

    public function test_save_profile_row_persists_full()
    {
        $userId = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($userId);
        $_POST[Frontend::STYLE_META] = 'full';

        (new Admin())->saveProfileRow($userId);

        $this->assertSame('full', get_user_meta($userId, Frontend::STYLE_META, true));
        unset($_POST[Frontend::STYLE_META]);
    }

    public function test_save_profile_row_normalizes_unknown_value_to_simple()
    {
        $userId = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($userId);
        $_POST[Frontend::STYLE_META] = 'something-else';

        (new Admin())->saveProfileRow($userId);

        $this->assertSame('simple', get_user_meta($userId, Frontend::STYLE_META, true));
        unset($_POST[Frontend::STYLE_META]);
    }

    public function test_save_profile_row_defaults_to_simple_when_post_key_missing()
    {
        // Characterization: not "leave the existing value alone" —
        // a save with no key overwrites the stored value to 'simple'.
        $userId = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($userId);
        update_user_meta($userId, Frontend::STYLE_META, 'full');
        unset($_POST[Frontend::STYLE_META]);

        (new Admin())->saveProfileRow($userId);

        $this->assertSame('simple', get_user_meta($userId, Frontend::STYLE_META, true));
    }

    public function test_save_profile_row_rejects_when_current_user_cannot_edit_target_user()
    {
        $targetId = self::factory()->user->create(['role' => 'administrator']);
        update_user_meta($targetId, Frontend::STYLE_META, 'full');

        $editorId = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editorId);
        $_POST[Frontend::STYLE_META] = 'simple';

        (new Admin())->saveProfileRow($targetId);

        $this->assertSame(
            'full',
            get_user_meta($targetId, Frontend::STYLE_META, true),
            'Editor must not be able to overwrite an admin user’s toolbar style.'
        );
        unset($_POST[Frontend::STYLE_META]);
    }

    public function test_reorder_row_outputs_script_that_targets_user_admin_bar_front_wrap()
    {
        $html = $this->capture(fn () => (new Admin())->reorderRow());

        $this->assertStringContainsString('<script>', $html);
        $this->assertStringContainsString("document.querySelector('tr.extendify-toolbar-style-wrap')", $html);
        $this->assertStringContainsString("document.querySelector('tr.user-admin-bar-front-wrap')", $html);
        $this->assertStringContainsString('insertBefore(ours, anchor.nextSibling)', $html);
    }

    private function capture(callable $fn): string
    {
        ob_start();
        $fn();
        return (string) ob_get_clean();
    }
}
