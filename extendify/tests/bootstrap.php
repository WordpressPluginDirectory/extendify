<?php

require_once dirname(__DIR__) . '/vendor/autoload.php';

$_tests_dir = getenv('WP_TESTS_DIR') ?: getenv('WP_PHPUNIT__DIR');

require_once $_tests_dir . '/includes/functions.php';

tests_add_filter('muplugins_loaded', function () {
    require_once dirname(__DIR__) . '/vendor/autoload.php';
});

require $_tests_dir . '/includes/bootstrap.php';
