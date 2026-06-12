<?php

namespace Extendify\Tests\Integration\QuickEdit;

use Extendify\Config;
use Extendify\PartnerData;
use Extendify\QuickEdit\Frontend;
use WP_UnitTestCase;

/**
 * Characterizes Edit Mode lifecycle gates:
 *
 *  - Frontend::registerAdminBar + Frontend::enqueue both gate on
 *    current_user_can(Config::$requiredCapability) — matches the
 *    plugin-wide bootstrap gate (default 'manage_options'). Editors
 *    do NOT see the pill or get the JS bundle.
 *
 *  - The 'showQuickEdit' partner flag (or the 'quick-edit' preview
 *    opt-in) gates the inline-edit surfaces: the admin-bar toggle node
 *    only registers when enabled, and the inline payload carries
 *    'quickEditEnabled' + a defaultOn that is false while QE is off.
 *    The selector JS bundle still enqueues either way — Ask AI rides
 *    on it independently.
 */
class EditModeLifecycleTest extends WP_UnitTestCase
{
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        // The plugin bootstrap normally defines these inside an IIFE
        // that does not run under PHPUnit. Default to non-DEVMODE so
        // the enqueue path matches a production install.
        if (!defined('EXTENDIFY_DEVMODE')) {
            define('EXTENDIFY_DEVMODE', false);
        }
        if (!defined('EXTENDIFY_REQUIRED_CAPABILITY')) {
            define('EXTENDIFY_REQUIRED_CAPABILITY', 'manage_options');
        }
        if (!defined('EXTENDIFY_PATH')) {
            define('EXTENDIFY_PATH', dirname(__DIR__, 3) . '/');
        }
        if (!defined('EXTENDIFY_BASE_URL')) {
            define('EXTENDIFY_BASE_URL', 'http://example.org/wp-content/plugins/extendify-sdk/');
        }
        // Stub the asset manifest rather than reading the real built file.
        // public/build/ is gitignored and the PHPUnit CI job never runs the
        // webpack build, so a disk read left the manifest empty there and the
        // enqueue() assertions failed only in CI (passed locally off a stale
        // build). A self-keyed stub is enough — enqueue() file_exists-guards
        // the asset .php require. Mirrors Toolbar/FrontendTest::setManifestEntries.
        Config::$assetManifest = [
            'extendify-quick-edit.php' => 'extendify-quick-edit.php',
            'extendify-quick-edit.js'  => 'extendify-quick-edit.js',
            'extendify-quick-edit.css' => 'extendify-quick-edit.css',
        ];
    }

    public function tearDown(): void
    {
        remove_all_actions('admin_bar_menu');
        remove_all_actions('wp_enqueue_scripts');
        // Static PartnerData::$config leaks across tests/classes — reset the
        // flag this suite flips so a later test doesn't inherit it.
        $this->setPartnerSetting('showQuickEdit', false);
        Config::$launchCompleted = false;
        unset($GLOBALS['wp_customize']);
        parent::tearDown();
    }

    public function test_constructor_hooks_admin_bar_menu_at_priority_100()
    {
        new Frontend();

        $this->assertSame(100, has_action('admin_bar_menu', [
            $this->latestFrontendInstance(),
            'registerAdminBar',
        ]));
    }

    public function test_constructor_hooks_wp_enqueue_scripts()
    {
        $frontend = new Frontend();

        $this->assertNotFalse(has_action('wp_enqueue_scripts', [
            $frontend,
            'enqueue',
        ]));
    }

    public function test_register_admin_bar_skips_when_logged_out()
    {
        wp_set_current_user(0);
        $bar = $this->fakeAdminBar();

        (new Frontend())->registerAdminBar($bar);

        $this->assertSame([], $bar->nodes);
    }

    public function test_register_admin_bar_skips_in_admin_context()
    {
        $this->loginAs('administrator');
        set_current_screen('edit-post');
        $bar = $this->fakeAdminBar();

        (new Frontend())->registerAdminBar($bar);

        $this->assertSame([], $bar->nodes);
        set_current_screen('front');
    }

    public function test_register_admin_bar_for_administrator_on_frontend()
    {
        $this->loginAs('administrator');
        $this->setPartnerSetting('showQuickEdit', true);
        $bar = $this->fakeAdminBar();

        (new Frontend())->registerAdminBar($bar);

        $this->assertCount(1, $bar->nodes);
        $this->assertSame('extendify-quick-edit-toggle', $bar->nodes[0]['id']);
        $this->assertStringContainsString('Quick Edit', $bar->nodes[0]['title']);
        $this->assertSame('switch', $bar->nodes[0]['meta']['role']);
    }

    public function test_register_admin_bar_skips_for_editor_without_manage_options()
    {
        // Locked down: the pill follows Config::$requiredCapability
        // (default manage_options). Editor role has edit_posts but not
        // manage_options, so the pill must not register.
        $this->loginAs('editor');
        $bar = $this->fakeAdminBar();

        (new Frontend())->registerAdminBar($bar);

        $this->assertSame([], $bar->nodes);
    }

    public function test_register_admin_bar_skips_for_subscriber()
    {
        $this->loginAs('subscriber');
        $bar = $this->fakeAdminBar();

        (new Frontend())->registerAdminBar($bar);

        $this->assertSame([], $bar->nodes);
    }

    public function test_enqueue_skips_when_user_lacks_required_capability()
    {
        // Editor (edit_posts but not manage_options) is the meaningful
        // boundary post-lockdown; subscriber would skip anyway.
        $this->loginAs('editor');

        (new Frontend())->enqueue();

        $this->assertFalse(wp_script_is('extendify-quick-edit', 'enqueued'));
        $this->assertFalse(wp_script_is('extendify-quick-edit', 'registered'));
    }

    public function test_enqueue_skips_when_logged_out()
    {
        wp_set_current_user(0);

        (new Frontend())->enqueue();

        $this->assertFalse(wp_script_is('extendify-quick-edit', 'enqueued'));
    }

    public function test_enqueue_skips_in_admin_context()
    {
        $this->loginAs('administrator');
        set_current_screen('edit-post');

        (new Frontend())->enqueue();

        $this->assertFalse(wp_script_is('extendify-quick-edit', 'enqueued'));
        set_current_screen('front');
    }

    public function test_enqueue_skips_in_customize_preview()
    {
        // The Customizer preview iframe renders the front end (is_admin()
        // false) for an admin user, so only is_customize_preview() tells QE
        // apart from a normal front-end request — it must not enqueue there.
        $this->loginAs('administrator');
        require_once ABSPATH . 'wp-includes/class-wp-customize-manager.php';
        $GLOBALS['wp_customize'] = new \WP_Customize_Manager();
        $GLOBALS['wp_customize']->start_previewing_theme();

        // Clear our handle so the assertion reflects THIS enqueue() call, not a
        // handle a prior test left enqueued (WP_Scripts persists across tests).
        wp_dequeue_script('extendify-quick-edit');

        (new Frontend())->enqueue();

        $this->assertFalse(wp_script_is('extendify-quick-edit', 'enqueued'));
    }

    public function test_enqueue_registers_inline_extQuickEditData_for_administrator()
    {
        $this->loginAs('administrator');

        (new Frontend())->enqueue();

        $this->assertTrue(wp_script_is('extendify-quick-edit', 'enqueued'));

        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $this->assertStringContainsString('window.extQuickEditData', $inline);
        $this->assertStringContainsString('"restRoot"', $inline);
        $this->assertStringContainsString('"schemas"', $inline);
        $this->assertStringContainsString('"defaultOn"', $inline);
    }

    public function test_enqueue_surfaces_translated_context_default_false()
    {
        // The payload always carries translatedContext so the client can gate
        // text edits on a translated render. With no multilingual plugin active
        // it reports the default-language shape. Detection per plugin is covered
        // in QuickEdit/Services/TranslatedContextTest.
        $this->loginAs('administrator');

        (new Frontend())->enqueue();

        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $payload = $this->extractInlineQuickEditData($inline);
        $this->assertArrayHasKey('translatedContext', $payload);
        $this->assertFalse($payload['translatedContext']['isTranslated']);
        $this->assertNull($payload['translatedContext']['plugin']);
    }

    public function test_enqueue_inline_data_surfaces_currency_symbol_when_wc_is_loaded()
    {
        // The bootstrap requires WooCommerce under WP_CONTENT_DIR.
        // If it didn't load, the producer side of this contract can't fire
        // and the JS modal falls back to '$' even on non-USD stores.
        if (!function_exists('get_woocommerce_currency_symbol')) {
            $this->markTestSkipped('WooCommerce required for currency symbol surfacing.');
        }

        update_option('woocommerce_currency', 'EUR');

        $this->loginAs('administrator');
        (new Frontend())->enqueue();

        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $this->assertStringContainsString('"currencySymbol"', $inline);
        $payload = $this->extractInlineQuickEditData($inline);
        $this->assertSame('€', $payload['context']['currencySymbol']);
    }

    /**
     * @return array<string,mixed>
     */
    private function extractInlineQuickEditData(string $inline): array
    {
        // The 'before' inline data accumulates one
        // `window.extQuickEditData = {...};` block per enqueue() across the
        // suite (WP_Scripts isn't reset between tests). The current test's
        // block is the last one appended, so anchor on the final prefix and
        // brace-walk (string-aware) to its matching close — a last-`}` scan
        // would instead span every block and yield invalid JSON.
        $prefix = 'window.extQuickEditData = ';
        $start = strrpos($inline, $prefix);
        $this->assertNotFalse($start, 'inline payload missing window.extQuickEditData');
        $string = substr($inline, $start + strlen($prefix));
        $json = '';
        $depth = 0;
        $inString = false;
        $escaped = false;
        for ($i = 0, $length = strlen($string); $i < $length; $i++) {
            $char = $string[$i];
            $json .= $char;
            if ($inString) {
                if ($escaped) {
                    $escaped = false;
                } elseif ($char === '\\') {
                    $escaped = true;
                } elseif ($char === '"') {
                    $inString = false;
                }
                continue;
            }
            if ($char === '"') {
                $inString = true;
            } elseif ($char === '{') {
                $depth++;
            } elseif ($char === '}') {
                $depth--;
                if ($depth === 0) {
                    break;
                }
            }
        }

        $decoded = json_decode($json, true);
        $this->assertIsArray($decoded);
        return $decoded;
    }

    public function test_enqueue_default_on_is_false_pre_launch()
    {
        // Pre-launch + non-DEVMODE: defaultOn is false. The user opts in
        // by toggling the admin-bar pill; persist hydrates that choice
        // on later visits.
        Config::$launchCompleted = false;
        $this->loginAs('administrator');

        (new Frontend())->enqueue();

        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $payload = $this->extractInlineQuickEditData($inline);
        $this->assertFalse($payload['defaultOn']);
    }

    public function test_enqueue_default_on_is_true_post_launch()
    {
        // Post-launch installs with QE enabled land with edit mode engaged
        // on first visit. The persisted toggle (zustand/persist) overrides
        // this on later visits — see tests/unit/QuickEdit/state/edit-mode.test.js.
        Config::$launchCompleted = true;
        $this->loginAs('administrator');
        $this->setPartnerSetting('showQuickEdit', true);

        (new Frontend())->enqueue();

        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $payload = $this->extractInlineQuickEditData($inline);
        $this->assertTrue($payload['defaultOn']);

        Config::$launchCompleted = false;
    }

    public function test_show_quick_edit_flag_gates_admin_bar_pill()
    {
        $this->loginAs('administrator');

        // Flag off (default) → no toggle node.
        $this->setPartnerSetting('showQuickEdit', false);
        $barOff = $this->fakeAdminBar();
        (new Frontend())->registerAdminBar($barOff);
        $this->assertSame([], $barOff->nodes);

        // Flag on → the Edit-mode toggle node registers.
        $this->setPartnerSetting('showQuickEdit', true);
        $barOn = $this->fakeAdminBar();
        (new Frontend())->registerAdminBar($barOn);
        $this->assertCount(1, $barOn->nodes);
        $this->assertSame('extendify-quick-edit-toggle', $barOn->nodes[0]['id']);
    }

    public function test_enqueue_still_loads_selector_bundle_when_quick_edit_off()
    {
        // showQuickEdit gates the inline surfaces, never the bundle load —
        // the selector ships for Ask AI regardless. quickEditEnabled rides
        // in the payload so the JS can gate the pills.
        $this->loginAs('administrator');
        $this->setPartnerSetting('showQuickEdit', false);

        (new Frontend())->enqueue();

        $this->assertTrue(wp_script_is('extendify-quick-edit', 'enqueued'));
        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $this->assertStringContainsString('"quickEditEnabled":false', $inline);
    }

    public function test_enqueue_surfaces_quick_edit_enabled_true_when_flag_on()
    {
        $this->loginAs('administrator');
        $this->setPartnerSetting('showQuickEdit', true);

        (new Frontend())->enqueue();

        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $this->assertStringContainsString('"quickEditEnabled":true', $inline);
    }

    public function test_enqueue_default_on_false_when_quick_edit_off_even_post_launch()
    {
        // The post-Launch auto-on is suppressed while QE is off — the agent's
        // Select button becomes the entry point instead. Asserted via the raw
        // inline JSON to sidestep the env-drifted extractInlineQuickEditData
        // helper.
        Config::$launchCompleted = true;
        $this->loginAs('administrator');
        $this->setPartnerSetting('showQuickEdit', false);

        (new Frontend())->enqueue();

        $inline = wp_scripts()->get_inline_script_data('extendify-quick-edit', 'before');
        $this->assertStringContainsString('"defaultOn":false', $inline);
    }

    private function loginAs(string $role): int
    {
        $user = self::factory()->user->create(['role' => $role]);
        wp_set_current_user($user);
        return $user;
    }

    private function fakeAdminBar(): object
    {
        return new class () {
            public array $nodes = [];
            public function add_node($node): void
            {
                $this->nodes[] = $node;
            }
        };
    }

    private function setPartnerSetting(string $key, $value): void
    {
        $prop = new \ReflectionProperty(PartnerData::class, 'config');
        $prop->setAccessible(true);
        $config = $prop->getValue();
        $config[$key] = $value;
        $prop->setValue(null, $config);
    }

    private function latestFrontendInstance(): Frontend
    {
        global $wp_filter;
        foreach ($wp_filter['admin_bar_menu']->callbacks[100] ?? [] as $cb) {
            if (is_array($cb['function']) && $cb['function'][0] instanceof Frontend) {
                return $cb['function'][0];
            }
        }
        $this->fail('No Frontend instance found on admin_bar_menu.');
    }
}
