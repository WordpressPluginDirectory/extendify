<?php

namespace Extendify\Tests\Integration\Shared\Services\PluginsActivation;

use Extendify\Shared\Services\PluginsActivation\Imagify;
use ReflectionMethod;
use WP_UnitTestCase;

class ImagifyTest extends WP_UnitTestCase
{
    private static function saveKey(array $data)
    {
        $method = new ReflectionMethod(Imagify::class, 'saveKey');
        $method->setAccessible(true);
        $method->invoke(null, $data);
    }

    public function test_save_key_stores_api_key_when_settings_absent()
    {
        self::saveKey(['api_key' => 'abc123']);

        $this->assertSame(['api_key' => 'abc123'], get_option('imagify_settings'));
    }

    public function test_save_key_preserves_existing_settings()
    {
        update_option('imagify_settings', ['optimization_level' => 2, 'api_key' => 'old']);

        self::saveKey(['api_key' => 'new456']);

        $this->assertSame(
            ['optimization_level' => 2, 'api_key' => 'new456'],
            get_option('imagify_settings')
        );
    }

    public function test_save_key_does_nothing_without_api_key()
    {
        update_option('imagify_settings', ['optimization_level' => 2]);

        self::saveKey([]);

        $this->assertSame(['optimization_level' => 2], get_option('imagify_settings'));
    }
}
