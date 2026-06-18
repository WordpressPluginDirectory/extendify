<?php

namespace Extendify\Tests\Integration;

use Extendify\Insights;
use WP_UnitTestCase;

class InsightsTest extends WP_UnitTestCase
{
    public function test_setup_rolls_a_variant_for_an_active_test()
    {
        delete_option(Insights::ACTIVE_TESTS_OPTION);

        Insights::setup(['AutoLaunch.ShowTitle']);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        $this->assertArrayHasKey('AutoLaunch.ShowTitle', $tests);
        $this->assertContains($tests['AutoLaunch.ShowTitle']['variant'], ['A', 'B']);
    }

    public function test_setup_rolls_each_active_test_independently_honoring_its_own_percentage()
    {
        // Alternate 0%/100% across the keys; each key's own percentage must
        // drive its own roll, regardless of the others.
        $active = [];
        $expected = [];
        foreach (Insights::AVAILABLE_TESTS as $i => $key) {
            $percentage = $i % 2 === 0 ? 0 : 100;
            $active[] = "{$key}:{$percentage}";
            $expected[$key] = ['variant' => $percentage === 0 ? 'A' : 'B', 'percentage' => (float) $percentage];
        }

        delete_option(Insights::ACTIVE_TESTS_OPTION);
        Insights::setup($active);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        foreach ($expected as $key => $expect) {
            $this->assertSame($expect['variant'], $tests[$key]['variant']);
            $this->assertSame($expect['percentage'], $tests[$key]['percentage']);
        }
    }

    public function test_setup_drops_inactive_tests()
    {
        update_option(Insights::ACTIVE_TESTS_OPTION, [
            'AutoLaunch.ShowTitle' => ['variant' => 'B'],
        ]);

        Insights::setup([]);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        $this->assertArrayNotHasKey('AutoLaunch.ShowTitle', $tests);
    }

    public function test_setup_keeps_the_variant_stable_across_calls()
    {
        update_option(Insights::ACTIVE_TESTS_OPTION, [
            'AutoLaunch.ShowTitle' => ['variant' => 'B'],
        ]);

        Insights::setup(['AutoLaunch.ShowTitle']);
        Insights::setup(['AutoLaunch.ShowTitle']);

        $assignment = get_option(Insights::ACTIVE_TESTS_OPTION)['AutoLaunch.ShowTitle'];
        $this->assertSame('B', $assignment['variant']);
    }

    public function test_setup_with_zero_percentage_always_rolls_a()
    {
        for ($i = 0; $i < 25; $i++) {
            delete_option(Insights::ACTIVE_TESTS_OPTION);
            Insights::setup(['AutoLaunch.ShowTitle:0']);
            $variant = get_option(Insights::ACTIVE_TESTS_OPTION)['AutoLaunch.ShowTitle']['variant'];
            $this->assertSame('A', $variant);
        }
    }

    public function test_setup_with_full_percentage_always_rolls_b()
    {
        for ($i = 0; $i < 25; $i++) {
            delete_option(Insights::ACTIVE_TESTS_OPTION);
            Insights::setup(['AutoLaunch.ShowTitle:100']);
            $variant = get_option(Insights::ACTIVE_TESTS_OPTION)['AutoLaunch.ShowTitle']['variant'];
            $this->assertSame('B', $variant);
        }
    }

    public function test_setup_stamps_assigned_at_and_keeps_it_stable()
    {
        delete_option(Insights::ACTIVE_TESTS_OPTION);

        Insights::setup(['AutoLaunch.ShowTitle']);
        $assignedAt = get_option(Insights::ACTIVE_TESTS_OPTION)['AutoLaunch.ShowTitle']['assignedAt'];
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/', $assignedAt);

        Insights::setup(['AutoLaunch.ShowTitle']);
        $this->assertSame(
            $assignedAt,
            get_option(Insights::ACTIVE_TESTS_OPTION)['AutoLaunch.ShowTitle']['assignedAt']
        );
    }

    public function test_setup_stores_the_active_percentage_on_the_assignment()
    {
        delete_option(Insights::ACTIVE_TESTS_OPTION);

        Insights::setup(['AutoLaunch.ShowTitle:20']);

        $assignment = get_option(Insights::ACTIVE_TESTS_OPTION)['AutoLaunch.ShowTitle'];
        $this->assertSame(20.0, $assignment['percentage']);
    }

    public function test_setup_stores_a_fractional_percentage()
    {
        delete_option(Insights::ACTIVE_TESTS_OPTION);

        Insights::setup(['AutoLaunch.ShowTitle:22.5']);

        $assignment = get_option(Insights::ACTIVE_TESTS_OPTION)['AutoLaunch.ShowTitle'];
        $this->assertSame(22.5, $assignment['percentage']);
    }

    public function test_setup_leaves_unknown_keys_untouched()
    {
        update_option(Insights::ACTIVE_TESTS_OPTION, ['SomeOther.Test' => 'A']);

        Insights::setup(['AutoLaunch.ShowTitle']);

        $tests = get_option(Insights::ACTIVE_TESTS_OPTION);
        $this->assertSame('A', $tests['SomeOther.Test']);
    }
}
