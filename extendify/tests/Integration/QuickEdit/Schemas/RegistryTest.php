<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\Button;
use Extendify\QuickEdit\Schemas\Cover;
use Extendify\QuickEdit\Schemas\Heading;
use Extendify\QuickEdit\Schemas\Image;
use Extendify\QuickEdit\Schemas\MediaText;
use Extendify\QuickEdit\Schemas\NavigationLink;
use Extendify\QuickEdit\Schemas\Paragraph;
use Extendify\QuickEdit\Schemas\Registry;
use Extendify\QuickEdit\Schemas\Schema;
use Extendify\QuickEdit\Schemas\SocialLink;
use ReflectionClass;
use WP_UnitTestCase;

class RegistryTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->resetRegistry();
    }

    public function tearDown(): void
    {
        $this->resetRegistry();
        parent::tearDown();
    }

    public function test_get_returns_null_for_unknown_block()
    {
        $this->assertNull(Registry::get('core/paragraph'));
        $this->assertNull(Registry::get('not/a-block'));
    }

    public function test_register_then_get_returns_the_instance()
    {
        $schema = new Paragraph();
        Registry::register('core/paragraph', $schema);

        $this->assertSame($schema, Registry::get('core/paragraph'));
    }

    public function test_register_overwrites_previous_entry()
    {
        $first  = new Paragraph();
        $second = new Paragraph();

        Registry::register('core/paragraph', $first);
        Registry::register('core/paragraph', $second);

        $this->assertSame($second, Registry::get('core/paragraph'));
    }

    public function test_init_registers_the_expected_block_names()
    {
        Registry::init();

        $expected = [
            'core/paragraph'          => Paragraph::class,
            'core/heading'            => Heading::class,
            'core/image'              => Image::class,
            'core/button'             => Button::class,
            'core/cover'              => Cover::class,
            'core/media-text'         => MediaText::class,
            'core/social-link'        => SocialLink::class,
            'core/navigation-link'    => NavigationLink::class,
            'core/navigation-submenu' => NavigationLink::class,
        ];

        foreach ($expected as $blockName => $class) {
            $schema = Registry::get($blockName);
            $this->assertInstanceOf(Schema::class, $schema, "missing schema for $blockName");
            $this->assertInstanceOf($class, $schema, "wrong class for $blockName");
        }
    }

    public function test_describe_returns_blockName_and_fields_per_registered_schema()
    {
        Registry::init();

        $described = Registry::describe();

        $this->assertArrayHasKey('core/paragraph', $described);
        $this->assertSame('core/paragraph', $described['core/paragraph']['blockName']);
        $this->assertSame((new Paragraph())->fields(), $described['core/paragraph']['fields']);

        $this->assertSame(
            [
                'core/paragraph',
                'core/heading',
                'core/image',
                'core/button',
                'core/cover',
                'core/media-text',
                'core/social-link',
                'core/navigation-link',
                'core/navigation-submenu',
            ],
            array_keys($described)
        );
    }

    public function test_describe_is_empty_when_nothing_registered()
    {
        $this->assertSame([], Registry::describe());
    }

    private function resetRegistry(): void
    {
        $reflection = new ReflectionClass(Registry::class);
        $prop = $reflection->getProperty('schemas');
        $prop->setAccessible(true);
        $prop->setValue(null, []);
    }
}
