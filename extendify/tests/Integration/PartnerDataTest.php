<?php

namespace Extendify\Tests\Integration;

use Extendify\PartnerData;
use WP_UnitTestCase;

/**
 * showQuickEdit + showSimpleToolbar must round-trip from the partner-data
 * response into PartnerData::setting(). __construct re-applies ~30 keys
 * from the merged response onto self::$config, but until this phase had
 * no line for these two — so setting() returned the hardcoded default
 * regardless of the partner value (the gate idiom in Toolbar/QuickEdit
 * would never see a true).
 */
class PartnerDataTest extends WP_UnitTestCase
{
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        // getPartnerData() opts out (returns []) without a partner id,
        // which would bypass the response→config re-apply under test.
        if (!defined('EXTENDIFY_PARTNER_ID')) {
            define('EXTENDIFY_PARTNER_ID', 'test-partner');
        }
    }

    public function setUp(): void
    {
        parent::setUp();
        // self::$config is static and survives across tests in-process;
        // reset to the declared defaults so each case starts clean.
        $this->setConfigValue('showQuickEdit', false);
        $this->setConfigValue('showSimpleToolbar', false);
        delete_transient('extendify_partner_data_cache_check');
    }

    public function test_show_quick_edit_true_in_response_round_trips_to_setting()
    {
        update_option('extendify_partner_data_v2', ['showQuickEdit' => true]);

        new PartnerData();

        $this->assertTrue(PartnerData::setting('showQuickEdit'));
    }

    public function test_show_simple_toolbar_true_in_response_round_trips_to_setting()
    {
        update_option('extendify_partner_data_v2', ['showSimpleToolbar' => true]);

        new PartnerData();

        $this->assertTrue(PartnerData::setting('showSimpleToolbar'));
    }

    public function test_flags_default_false_when_absent_from_response()
    {
        update_option('extendify_partner_data_v2', ['license' => 'active']);

        new PartnerData();

        $this->assertFalse(PartnerData::setting('showQuickEdit'));
        $this->assertFalse(PartnerData::setting('showSimpleToolbar'));
    }

    private function setConfigValue(string $key, $value): void
    {
        $prop = new \ReflectionProperty(PartnerData::class, 'config');
        $prop->setAccessible(true);
        $config = $prop->getValue();
        $config[$key] = $value;
        $prop->setValue(null, $config);
    }
}
