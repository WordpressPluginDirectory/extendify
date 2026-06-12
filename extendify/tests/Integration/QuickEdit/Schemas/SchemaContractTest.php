<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\Schema;
use WP_UnitTestCase;

class SchemaContractTest extends WP_UnitTestCase
{
    public function test_schema_is_an_interface()
    {
        $reflection = new \ReflectionClass(Schema::class);

        $this->assertTrue($reflection->isInterface());
    }

    public function test_interface_declares_only_fields_and_apply()
    {
        $reflection = new \ReflectionClass(Schema::class);
        $names = array_map(
            static fn (\ReflectionMethod $m) => $m->getName(),
            $reflection->getMethods()
        );
        sort($names);

        // The interface intentionally has no load/validate/error hooks —
        // save orchestration lives in SaveController, not the schema.
        $this->assertSame(['apply', 'fields'], $names);
    }

    public function test_apply_signature_takes_block_fieldKey_value_and_returns_array()
    {
        $reflection = new \ReflectionMethod(Schema::class, 'apply');
        $params = $reflection->getParameters();

        $this->assertCount(3, $params);
        $this->assertSame('block',    $params[0]->getName());
        $this->assertSame('fieldKey', $params[1]->getName());
        $this->assertSame('value',    $params[2]->getName());

        $this->assertSame('array',  (string) $params[0]->getType());
        $this->assertSame('string', (string) $params[1]->getType());
        $this->assertFalse($params[2]->hasType(), 'value is intentionally untyped (mixed payload)');

        $this->assertSame('array', (string) $reflection->getReturnType());
    }

    public function test_fields_signature_returns_array()
    {
        $reflection = new \ReflectionMethod(Schema::class, 'fields');

        $this->assertCount(0, $reflection->getParameters());
        $this->assertSame('array', (string) $reflection->getReturnType());
    }

    public function test_a_concrete_schema_round_trips_through_apply()
    {
        $schema = new FakeSchema();

        $this->assertSame(
            [
                ['key' => 'title', 'control' => 'text', 'label' => 'Title'],
            ],
            $schema->fields()
        );

        $block = ['blockName' => 'fake/block', 'attrs' => [], 'innerHTML' => 'old'];

        // Known field mutates.
        $mutated = $schema->apply($block, 'title', 'new');
        $this->assertSame('new', $mutated['attrs']['title']);

        // Unknown field returns the block unchanged — characterizes the
        // pattern every concrete schema follows (default-return branch).
        $this->assertSame($block, $schema->apply($block, 'unknown-field', 'whatever'));
    }
}

class FakeSchema implements Schema
{
    public function fields(): array
    {
        return [
            ['key' => 'title', 'control' => 'text', 'label' => 'Title'],
        ];
    }

    public function apply(array $block, string $fieldKey, $value): array
    {
        if ($fieldKey !== 'title') {
            return $block;
        }
        $attrs = $block['attrs'] ?? [];
        $attrs['title'] = (string) $value;
        $block['attrs'] = $attrs;
        return $block;
    }
}
