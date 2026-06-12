<?php

require_once dirname(__DIR__) . '/vendor/autoload.php';

$_tests_dir = getenv('WP_TESTS_DIR') ?: getenv('WP_PHPUNIT__DIR');

require_once $_tests_dir . '/includes/functions.php';

tests_add_filter('muplugins_loaded', function () {
    require_once dirname(__DIR__) . '/vendor/autoload.php';

    // The plugin defines this in bootstrap.php, which the test harness never
    // loads. Config::$requiredCapability reads it at class-load, so any test
    // touching Config (e.g. the QuickEdit taggers' capability check) needs it.
    // Guarded so a real WP install that already defined it wins.
    if (!defined('EXTENDIFY_REQUIRED_CAPABILITY')) {
        define('EXTENDIFY_REQUIRED_CAPABILITY', 'manage_options');
    }

    if (getenv('EXTENDIFY_TEST_SKIP_OPTIONAL_PLUGINS') === '1') {
        return;
    }

    $required = [
        'WooCommerce'   => WP_CONTENT_DIR . '/plugins/woocommerce/woocommerce.php',
        'WPForms Lite'  => WP_CONTENT_DIR . '/plugins/wpforms-lite/wpforms.php',
    ];

    foreach ($required as $label => $entrypoint) {
        if (!is_readable($entrypoint)) {
            fwrite(
                STDERR,
                "extendify-sdk tests require $label at $entrypoint.\n"
                . "Install it under WP_CONTENT_DIR/plugins/ or set "
                . "EXTENDIFY_TEST_SKIP_OPTIONAL_PLUGINS=1 to skip the "
                . "WooCommerce + WPForms test paths.\n"
            );
            exit(1);
        }
        require_once $entrypoint;
    }
});

// WC builds its custom tables on activation; a bare require_once doesn't, and
// its own init-time self-install is too late for the first test on the fresh
// DB CI provisions each run. Mirrors WC's own PHPUnit bootstrap.
tests_add_filter('setup_theme', function () {
    if (!class_exists('WC_Install')) {
        return;
    }
    \WC_Install::install();
    $GLOBALS['wp_roles'] = new \WP_Roles(); // install() grants WC caps to roles
});

require $_tests_dir . '/includes/bootstrap.php';
