<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\Cover;
use WP_UnitTestCase;

class CoverTest extends WP_UnitTestCase
{
    public function test_fields_returns_single_background_field()
    {
        $fields = (new Cover())->fields();

        $this->assertCount(1, $fields);
        $this->assertSame('background', $fields[0]['key']);
        $this->assertSame('image',      $fields[0]['control']);
    }

    public function test_apply_with_valid_id_derives_url_and_patches_innerContent_chunks()
    {
        // innerContent for a cover with inner blocks is `[wrapper_open, null, wrapper_close]`;
        // the nulls map to innerBlocks at serialize time.
        $attId       = self::factory()->attachment->create_upload_object($this->writeStubPng());
        $expectedUrl = wp_get_attachment_image_url($attId, 'full');

        $open = '<div class="wp-block-cover"><img class="wp-block-cover__image-background wp-image-1" src="/old.jpg" />';
        $close = '</div>';
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => ['url' => '/old.jpg', 'id' => 1, 'hasParallax' => true],
            'innerBlocks'  => [['blockName' => 'core/paragraph', 'attrs' => [], 'innerBlocks' => [], 'innerHTML' => '', 'innerContent' => []]],
            'innerHTML'    => $open . $close,
            'innerContent' => [$open, null, $close],
        ];

        // The server-derived url must win over the hostile client url.
        $result = (new Cover())->apply($block, 'background', [
            'url' => 'https://attacker.test/evil.jpg',
            'id'  => $attId,
        ]);

        $this->assertSame($expectedUrl, $result['attrs']['url']);
        $this->assertSame($attId, $result['attrs']['id']);
        // hasParallax is intentionally removed — the rebuilt block can't carry it through.
        $this->assertArrayNotHasKey('hasParallax', $result['attrs']);

        // innerContent[1] stays null (innerBlocks slot preserved).
        $this->assertNull($result['innerContent'][1]);

        // The opening chunk got patched with the server url, not the client's.
        $this->assertStringContainsString('src="' . $expectedUrl . '"', $result['innerContent'][0]);
        $this->assertStringNotContainsString('attacker.test', $result['innerContent'][0]);
        // Exact class proves the stale wp-image-1 was replaced by the new id
        // (a substring check would trip on ids that start with "1").
        $this->assertStringContainsString(
            'class="wp-block-cover__image-background wp-image-' . $attId . '"',
            $result['innerContent'][0]
        );
    }

    public function test_apply_with_positive_but_invalid_id_returns_block_unchanged()
    {
        $open = '<div class="wp-block-cover"><img class="wp-block-cover__image-background wp-image-1" src="/old.jpg" />';
        $close = '</div>';
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => ['url' => '/old.jpg', 'id' => 1],
            'innerBlocks'  => [],
            'innerHTML'    => $open . $close,
            'innerContent' => [$open, null, $close],
        ];

        // id resolves to no real image attachment: reject rather than trust the client url.
        $result = (new Cover())->apply($block, 'background', [
            'url' => 'https://attacker.test/evil.jpg',
            'id'  => 999999,
        ]);

        $this->assertSame($block, $result);
    }

    public function test_apply_without_id_strips_srcset_sizes_and_wp_image_class()
    {
        $open = '<div class="wp-block-cover"><img class="wp-block-cover__image-background wp-image-7" src="/old.jpg" srcset="/old-2x.jpg 2x" sizes="100vw" />';
        $close = '</div>';
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => ['url' => '/old.jpg', 'id' => 7],
            'innerBlocks'  => [],
            'innerHTML'    => $open . $close,
            'innerContent' => [$open, null, $close],
        ];

        $result = (new Cover())->apply($block, 'background', ['url' => 'https://example.test/new.jpg']);

        $this->assertArrayNotHasKey('id', $result['attrs']);
        $this->assertStringNotContainsString('srcset=', $result['innerContent'][0]);
        $this->assertStringNotContainsString('sizes=',  $result['innerContent'][0]);
        $this->assertStringNotContainsString('wp-image-', $result['innerContent'][0]);
    }

    public function test_apply_strips_extendify_image_import_marker_from_wrapper_div()
    {
        $open = '<div class="wp-block-cover extendify-image-import"><img class="wp-block-cover__image-background" src="/old.jpg" />';
        $close = '</div>';
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => [],
            'innerBlocks'  => [],
            'innerHTML'    => $open . $close,
            'innerContent' => [$open, null, $close],
        ];

        $result = (new Cover())->apply($block, 'background', ['url' => 'https://example.test/new.jpg']);

        $this->assertStringNotContainsString('extendify-image-import', $result['innerContent'][0]);
        $this->assertStringContainsString('wp-block-cover', $result['innerContent'][0]);
    }

    public function test_apply_skips_color_only_cover_without_image_background_img()
    {
        // Color-only / video covers have no `wp-block-cover__image-background` img;
        // apply() updates attrs but leaves innerContent alone.
        $open = '<div class="wp-block-cover">';
        $close = '</div>';
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => ['overlayColor' => 'primary'],
            'innerBlocks'  => [],
            'innerHTML'    => $open . $close,
            'innerContent' => [$open, null, $close],
        ];

        $result = (new Cover())->apply($block, 'background', ['url' => 'https://example.test/new.jpg']);

        // attrs update happens even without an image-background to patch.
        $this->assertSame('https://example.test/new.jpg', $result['attrs']['url']);
        // The innerContent is left as-is — no synthesized <img>.
        $this->assertSame($block['innerContent'], $result['innerContent']);
        // innerHTML is untouched (only rewritten when innerContent is patched).
        $this->assertSame($block['innerHTML'], $result['innerHTML']);
    }

    public function test_apply_with_no_url_returns_block_unchanged()
    {
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => [],
            'innerBlocks'  => [],
            'innerHTML'    => '<div></div>',
            'innerContent' => ['<div>', null, '</div>'],
        ];

        $this->assertSame($block, (new Cover())->apply($block, 'background', ['url' => '']));
        $this->assertSame($block, (new Cover())->apply($block, 'background', []));
    }

    public function test_apply_with_non_array_value_returns_block_unchanged()
    {
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => [],
            'innerBlocks'  => [],
            'innerHTML'    => '<div></div>',
            'innerContent' => ['<div>', null, '</div>'],
        ];

        $this->assertSame($block, (new Cover())->apply($block, 'background', 'string'));
    }

    public function test_apply_with_unknown_field_returns_block_unchanged()
    {
        $block = [
            'blockName'    => 'core/cover',
            'attrs'        => [],
            'innerBlocks'  => [],
            'innerHTML'    => '<div></div>',
            'innerContent' => ['<div>', null, '</div>'],
        ];

        $this->assertSame($block, (new Cover())->apply($block, 'overlayColor', 'red'));
    }

    private function writeStubPng(): string
    {
        // 1×1 transparent PNG so create_upload_object yields a real image attachment.
        $bytes = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        );
        $path = wp_tempnam('qe-test-stub') . '.png';
        file_put_contents($path, $bytes);
        return $path;
    }
}
