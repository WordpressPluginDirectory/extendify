<?php

namespace Extendify\Tests\Integration\QuickEdit\Services {

    use Extendify\QuickEdit\Services\TranslatedContext;
    use WP_UnitTestCase;

    /**
     * Characterizes TranslatedContext::detect() — the server-side check for
     * whether the current front-end render is showing a non-default-language
     * translation, across the three supported multilingual plugins:
     *
     *  - TranslatePress: trp_settings['default-language'] vs the $TRP_LANGUAGE
     *    global the plugin resolves per request.
     *  - WPML: the wpml_current_language / wpml_default_language filters.
     *  - Polylang: pll_current_language() / pll_default_language().
     *
     * WPML is filter-driven and Polylang is exercised through global-namespace
     * function stubs (defined below) so neither plugin needs to be installed.
     */
    class TranslatedContextTest extends WP_UnitTestCase
    {
        public function tearDown(): void
        {
            remove_all_filters('wpml_current_language');
            remove_all_filters('wpml_default_language');
            delete_option('trp_settings');
            unset(
                $GLOBALS['TRP_LANGUAGE'],
                $GLOBALS['__qe_test_pll_current'],
                $GLOBALS['__qe_test_pll_default']
            );
            parent::tearDown();
        }

        public function test_no_multilingual_plugin_reports_not_translated()
        {
            $result = TranslatedContext::detect();

            $this->assertFalse($result['isTranslated']);
            $this->assertNull($result['plugin']);
        }

        public function test_translatepress_translated_when_current_differs_from_default()
        {
            update_option('trp_settings', ['default-language' => 'en_US']);
            $GLOBALS['TRP_LANGUAGE'] = 'es_ES';

            $result = TranslatedContext::detect();

            $this->assertTrue($result['isTranslated']);
            $this->assertSame('translatepress', $result['plugin']);
        }

        public function test_translatepress_not_translated_on_default_language()
        {
            update_option('trp_settings', ['default-language' => 'en_US']);
            $GLOBALS['TRP_LANGUAGE'] = 'en_US';

            $result = TranslatedContext::detect();

            $this->assertFalse($result['isTranslated']);
            $this->assertNull($result['plugin']);
        }

        public function test_wpml_translated_when_current_differs_from_default()
        {
            add_filter('wpml_current_language', function () {
                return 'es';
            });
            add_filter('wpml_default_language', function () {
                return 'en';
            });

            $result = TranslatedContext::detect();

            $this->assertTrue($result['isTranslated']);
            $this->assertSame('wpml', $result['plugin']);
        }

        public function test_wpml_not_translated_on_default_language()
        {
            add_filter('wpml_current_language', function () {
                return 'en';
            });
            add_filter('wpml_default_language', function () {
                return 'en';
            });

            $result = TranslatedContext::detect();

            $this->assertFalse($result['isTranslated']);
            $this->assertNull($result['plugin']);
        }

        public function test_polylang_translated_when_current_differs_from_default()
        {
            $GLOBALS['__qe_test_pll_current'] = 'es';
            $GLOBALS['__qe_test_pll_default'] = 'en';

            $result = TranslatedContext::detect();

            $this->assertTrue($result['isTranslated']);
            $this->assertSame('polylang', $result['plugin']);
        }

        public function test_polylang_not_translated_on_default_language()
        {
            $GLOBALS['__qe_test_pll_current'] = 'en';
            $GLOBALS['__qe_test_pll_default'] = 'en';

            $result = TranslatedContext::detect();

            $this->assertFalse($result['isTranslated']);
            $this->assertNull($result['plugin']);
        }
    }
}

namespace {

    // Polylang ships pll_current_language() / pll_default_language() as global
    // functions. Stub them when the plugin is absent so TranslatedContext's
    // Polylang branch can run under test; the return values are driven by the
    // globals each test sets, and an unset global reads as "no language" (false).
    if (!function_exists('pll_current_language')) {
        function pll_current_language($field = 'slug')
        {
            return isset($GLOBALS['__qe_test_pll_current']) ? $GLOBALS['__qe_test_pll_current'] : false;
        }
    }

    if (!function_exists('pll_default_language')) {
        function pll_default_language($field = 'slug')
        {
            return isset($GLOBALS['__qe_test_pll_default']) ? $GLOBALS['__qe_test_pll_default'] : false;
        }
    }
}
