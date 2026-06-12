<?php

namespace Extendify\Tests\Integration\Toolbar;

use Extendify\Config;
use Extendify\PartnerData;
use Extendify\Toolbar\Frontend;
use WP_UnitTestCase;

/**
 * Characterizes the render-decision truth table for the simple
 * front-end toolbar.
 *
 * Findings pinned:
 *
 *  - shouldRender() gates on `edit_posts`, matching the QuickEdit
 *    pill (not `manage_options`).
 *  - The Launch-aware default (`defaultStyle()`) flips on
 *    `Config::$launchCompleted`. Pre-Launch the toolbar never
 *    renders by default — it returns 'full' and the style check
 *    fails. Post-Launch it returns 'simple' and the bar appears.
 *  - The core admin bar is left in the DOM and hidden via CSS so
 *    the Agent's mounted button still exists for the toolbar's
 *    "AI Agent" link to drive. `hideCoreAdminBar()` emits the
 *    reservation CSS only when `shouldRender()` is true.
 *  - `loadScriptsAndStyles` aborts when the asset manifest is
 *    missing the entry — useful failure mode for a fresh checkout
 *    that hasn't been built yet.
 */
class FrontendTest extends WP_UnitTestCase
{
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        if (!defined('EXTENDIFY_REQUIRED_CAPABILITY')) {
            define('EXTENDIFY_REQUIRED_CAPABILITY', 'manage_options');
        }
        if (!defined('EXTENDIFY_DEVMODE')) {
            define('EXTENDIFY_DEVMODE', false);
        }
        if (!defined('EXTENDIFY_PATH')) {
            define('EXTENDIFY_PATH', dirname(__DIR__, 3) . '/');
        }
        if (!defined('EXTENDIFY_BASE_URL')) {
            define('EXTENDIFY_BASE_URL', 'http://example.org/wp-content/plugins/extendify-sdk/');
        }
    }

    public function tearDown(): void
    {
        remove_all_actions('wp_enqueue_scripts');
        remove_all_actions('wp_body_open');
        remove_all_actions('wp_head');
        wp_dequeue_script('extendify-toolbar-scripts');
        wp_deregister_script('extendify-toolbar-scripts');
        wp_dequeue_style('extendify-toolbar-styles');
        wp_deregister_style('extendify-toolbar-styles');
        Config::$assetManifest = [];
        Config::$launchCompleted = false;
        // Static PartnerData::$config leaks across tests/classes.
        $this->setPartnerSetting('showQuickEdit', false);
        set_current_screen('front');
        unset($GLOBALS['wp_customize']);
        parent::tearDown();
    }

    public function test_constructor_hooks_three_actions()
    {
        $frontend = new Frontend();

        $this->assertNotFalse(has_action('wp_enqueue_scripts', [$frontend, 'loadScriptsAndStyles']));
        $this->assertNotFalse(has_action('wp_body_open', [$frontend, 'render']));
        $this->assertNotFalse(has_action('wp_head', [$frontend, 'hideCoreAdminBar']));
    }

    public function test_default_style_is_full_pre_launch()
    {
        Config::$launchCompleted = false;
        $this->assertSame('full', Frontend::defaultStyle());
    }

    public function test_default_style_is_simple_post_launch()
    {
        Config::$launchCompleted = true;
        $this->assertSame('simple', Frontend::defaultStyle());
    }

    public function test_style_returns_default_when_user_has_not_picked()
    {
        Config::$launchCompleted = true;
        $userId = self::factory()->user->create(['role' => 'editor']);
        delete_user_meta($userId, Frontend::STYLE_META);

        $this->assertSame('simple', Frontend::style($userId));
    }

    public function test_style_honors_user_meta_over_default()
    {
        Config::$launchCompleted = true;
        $userId = self::factory()->user->create(['role' => 'editor']);
        update_user_meta($userId, Frontend::STYLE_META, 'full');

        $this->assertSame('full', Frontend::style($userId));
    }

    public function test_style_ignores_invalid_meta_values()
    {
        Config::$launchCompleted = false;
        $userId = self::factory()->user->create(['role' => 'editor']);
        update_user_meta($userId, Frontend::STYLE_META, 'garbage');

        $this->assertSame('full', Frontend::style($userId));
    }

    public function test_style_falls_back_to_default_when_no_user_in_context()
    {
        Config::$launchCompleted = true;
        wp_set_current_user(0);

        $this->assertSame('simple', Frontend::style());
    }

    public function test_should_render_false_in_admin_context()
    {
        $this->primeRenderable();
        set_current_screen('edit-post');

        $this->assertFalse(Frontend::shouldRender());
    }

    public function test_should_render_false_in_customize_preview()
    {
        // The Customizer preview iframe renders the front end for an admin —
        // only is_customize_preview() distinguishes it from the live page, so
        // the simple toolbar must not render there.
        $this->primeRenderableSimple();
        require_once ABSPATH . 'wp-includes/class-wp-customize-manager.php';
        $GLOBALS['wp_customize'] = new \WP_Customize_Manager();
        $GLOBALS['wp_customize']->start_previewing_theme();

        $this->assertFalse(Frontend::shouldRender());
    }

    public function test_should_render_false_when_logged_out()
    {
        $this->primeRenderable();
        wp_set_current_user(0);

        $this->assertFalse(Frontend::shouldRender());
    }

    public function test_should_render_false_for_subscriber_lacking_required_capability()
    {
        $this->primeRenderable();
        $userId = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($userId);
        update_user_option($userId, 'show_admin_bar_front', 'true');

        $this->assertFalse(Frontend::shouldRender());
    }

    public function test_should_render_false_for_editor_lacking_manage_options()
    {
        // Locked down: shouldRender gates on Config::$requiredCapability
        // (default manage_options). Editors have edit_posts but not
        // manage_options, so the simple toolbar must NOT render for them.
        $this->primeRenderable();
        $userId = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($userId);
        update_user_option($userId, 'show_admin_bar_front', 'true');
        update_user_meta($userId, Frontend::STYLE_META, 'simple');

        $this->assertFalse(Frontend::shouldRender());
    }

    public function test_should_render_false_when_core_show_admin_bar_pref_off()
    {
        $userId = $this->primeRenderable();
        update_user_option($userId, 'show_admin_bar_front', 'false');

        $this->assertFalse(Frontend::shouldRender());
    }

    public function test_should_render_false_when_style_resolves_to_full()
    {
        $userId = $this->primeRenderable();
        update_user_meta($userId, Frontend::STYLE_META, 'full');

        $this->assertFalse(Frontend::shouldRender());
    }

    public function test_should_render_true_for_administrator_with_simple_style()
    {
        $userId = $this->primeRenderable();
        update_user_meta($userId, Frontend::STYLE_META, 'simple');

        $this->assertTrue(Frontend::shouldRender());
    }

    public function test_load_scripts_and_styles_skips_when_should_render_false()
    {
        wp_set_current_user(0);

        (new Frontend())->loadScriptsAndStyles();

        $this->assertFalse(wp_script_is('extendify-toolbar-scripts', 'enqueued'));
        $this->assertFalse(wp_style_is('extendify-toolbar-styles', 'enqueued'));
    }

    public function test_load_scripts_and_styles_skips_when_manifest_missing_entry()
    {
        $this->primeRenderableSimple();
        Config::$assetManifest = [];

        (new Frontend())->loadScriptsAndStyles();

        $this->assertFalse(wp_script_is('extendify-toolbar-scripts', 'enqueued'));
    }

    public function test_load_scripts_and_styles_enqueues_when_renderable_with_manifest()
    {
        $this->primeRenderableSimple();
        $this->setManifestEntries(['extendify-toolbar.php', 'extendify-toolbar.js']);

        (new Frontend())->loadScriptsAndStyles();

        $this->assertTrue(wp_script_is('extendify-toolbar-scripts', 'enqueued'));
    }

    public function test_load_scripts_and_styles_enqueues_css_when_manifest_includes_it()
    {
        $this->primeRenderableSimple();
        $this->setManifestEntries([
            'extendify-toolbar.php',
            'extendify-toolbar.js',
            'extendify-toolbar.css',
        ]);

        (new Frontend())->loadScriptsAndStyles();

        $this->assertTrue(wp_style_is('extendify-toolbar-styles', 'enqueued'));
    }

    public function test_render_outputs_nothing_when_should_render_false()
    {
        wp_set_current_user(0);

        $html = $this->capture(fn () => (new Frontend())->render());

        $this->assertSame('', trim($html));
    }

    public function test_render_emits_nothing_for_logged_in_subscriber()
    {
        // Front-end exposure: a logged-in under-priv viewer can
        // still browse the public page; the toolbar markup (and the wp-admin
        // link / queried post-edit URL in it) must never reach them. The
        // logged-out test above passes even if only the cap check were
        // dropped, so pin the render() sink directly for a logged-in
        // below-cap user.
        $this->primeRenderableSimple();
        $userId = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($userId);
        update_user_option($userId, 'show_admin_bar_front', 'true');
        update_user_meta($userId, Frontend::STYLE_META, 'simple');

        $html = $this->capture(fn () => (new Frontend())->render());

        $this->assertSame('', trim($html));
    }

    public function test_render_emits_nothing_for_editor_lacking_required_capability()
    {
        // Same exposure check one rung up: an editor has
        // edit_posts but not the default manage_options gate, so the simple
        // toolbar must not render (or leak its markup) for them either.
        $this->primeRenderableSimple();
        $userId = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($userId);
        update_user_option($userId, 'show_admin_bar_front', 'true');
        update_user_meta($userId, Frontend::STYLE_META, 'simple');

        $html = $this->capture(fn () => (new Frontend())->render());

        $this->assertSame('', trim($html));
    }

    public function test_toolbar_does_not_remove_core_admin_bar_from_dom()
    {
        // Replacing the admin bar must not drop
        // a security-relevant core control. The toolbar hides #wpadminbar via
        // CSS only (display:none), leaving the core bar enabled so its logout
        // and nonce'd controls stay in the DOM (and the Agent's mounted button
        // stays present for the toolbar's "AI Agent" link to drive). Pin that
        // we never suppress the bar via the show_admin_bar filter — a
        // regression adding __return_false there would turn this red.
        $this->primeRenderableSimple();

        new Frontend();

        $this->assertTrue((bool) apply_filters('show_admin_bar', true));
    }

    public function test_render_outputs_toolbar_without_quick_edit_button_when_flag_off()
    {
        // showQuickEdit defaults off → the Edit-mode toggle is omitted, but
        // the rest of the simple toolbar (AI Agent, WP Admin) still renders.
        $this->primeRenderableSimple();

        $html = $this->capture(fn () => (new Frontend())->render());

        $this->assertStringContainsString('id="extendify-toolbar"', $html);
        $this->assertStringContainsString('id="ext-tb-ai-agent"', $html);
        $this->assertStringContainsString('WP Admin', $html);
        $this->assertStringNotContainsString('id="ext-tb-quick-edit"', $html);
    }

    public function test_render_includes_quick_edit_button_when_show_quick_edit_on()
    {
        $this->primeRenderableSimple();
        $this->setPartnerSetting('showQuickEdit', true);

        $html = $this->capture(fn () => (new Frontend())->render());

        $this->assertStringContainsString('id="ext-tb-quick-edit"', $html);
        $this->assertStringContainsString('role="switch"', $html);
        $this->assertStringContainsString('aria-checked="false"', $html);
    }

    public function test_render_emits_post_edit_link_when_queried_object_is_a_post()
    {
        $this->primeRenderableSimple('administrator');
        $postId = self::factory()->post->create(['post_status' => 'publish']);
        global $wp_query;
        $wp_query->queried_object = get_post($postId);
        $wp_query->queried_object_id = $postId;

        $html = $this->capture(fn () => (new Frontend())->render());

        $this->assertStringContainsString('ext-tb-edit', $html);
        $this->assertStringContainsString('post.php?post=' . $postId, $html);
    }

    public function test_render_omits_post_edit_link_when_no_post_in_context()
    {
        $this->primeRenderableSimple();
        global $wp_query;
        $wp_query->queried_object = null;

        $html = $this->capture(fn () => (new Frontend())->render());

        $this->assertStringContainsString('id="extendify-toolbar"', $html);
        $this->assertStringNotContainsString('ext-tb-edit', $html);
    }

    public function test_hide_core_admin_bar_emits_reset_css_when_renderable()
    {
        $this->primeRenderableSimple();

        $html = $this->capture(fn () => (new Frontend())->hideCoreAdminBar());

        $this->assertStringContainsString('id="extendify-toolbar-reset"', $html);
        $this->assertStringContainsString('#wpadminbar { display: none', $html);
        $this->assertStringContainsString('margin-top: 32px', $html);
    }

    public function test_hide_core_admin_bar_emits_nothing_when_not_renderable()
    {
        wp_set_current_user(0);

        $html = $this->capture(fn () => (new Frontend())->hideCoreAdminBar());

        $this->assertSame('', trim($html));
    }

    /**
     * Set up a logged-in user with the core "show admin bar on front"
     * pref turned on, front-end screen, and `Config::$launchCompleted`
     * = true so `defaultStyle()` would return 'simple'.
     *
     * Returns the user id so the test can layer meta or further setup
     * on top.
     */
    private function primeRenderable(string $role = 'administrator'): int
    {
        Config::$launchCompleted = true;
        $userId = self::factory()->user->create(['role' => $role]);
        wp_set_current_user($userId);
        update_user_option($userId, 'show_admin_bar_front', 'true');
        set_current_screen('front');
        return $userId;
    }

    /**
     * Same as primeRenderable plus an explicit 'simple' user meta so
     * style() resolves to 'simple' even if a future change makes the
     * Launch-aware default less reliable.
     */
    private function primeRenderableSimple(string $role = 'administrator'): int
    {
        $userId = $this->primeRenderable($role);
        update_user_meta($userId, Frontend::STYLE_META, 'simple');
        return $userId;
    }

    private function setPartnerSetting(string $key, $value): void
    {
        $prop = new \ReflectionProperty(PartnerData::class, 'config');
        $prop->setAccessible(true);
        $config = $prop->getValue();
        $config[$key] = $value;
        $prop->setValue(null, $config);
    }

    private function setManifestEntries(array $keys): void
    {
        $manifest = [];
        foreach ($keys as $key) {
            $manifest[$key] = $key;
        }
        Config::$assetManifest = $manifest;
    }

    private function capture(callable $fn): string
    {
        ob_start();
        $fn();
        return (string) ob_get_clean();
    }
}
