<?php

namespace Extendify\Tests\Integration;

use Extendify\Insights;
use WP_UnitTestCase;

class InsightsTest extends WP_UnitTestCase
{
    public function test_setup_rolls_a_variant_for_an_active_test()
    {
        delete_option(Insights::ACTIVE_TESTS_OPTION);

        Insights::setup(['AutoLaunch.WebsiteTitle']);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        $this->assertArrayHasKey('AutoLaunch.WebsiteTitle', $tests);
        $this->assertContains($tests['AutoLaunch.WebsiteTitle'], ['A', 'B']);
    }

    public function test_setup_drops_inactive_tests()
    {
        update_option(Insights::ACTIVE_TESTS_OPTION, ['AutoLaunch.WebsiteTitle' => 'B']);

        Insights::setup([]);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        $this->assertArrayNotHasKey('AutoLaunch.WebsiteTitle', $tests);
    }

    public function test_setup_keeps_an_already_assigned_variant()
    {
        update_option(Insights::ACTIVE_TESTS_OPTION, ['AutoLaunch.WebsiteTitle' => 'B']);

        Insights::setup(['AutoLaunch.WebsiteTitle']);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        $this->assertSame('B', $tests['AutoLaunch.WebsiteTitle']);
    }

    public function test_setup_leaves_unknown_keys_untouched()
    {
        update_option(Insights::ACTIVE_TESTS_OPTION, ['SomeOther.Test' => 'A']);

        Insights::setup(['AutoLaunch.WebsiteTitle']);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        $this->assertSame('A', $tests['SomeOther.Test']);
    }
}
