<?php

namespace Extendify\Tests\Integration\QuickEdit\Schemas;

use Extendify\QuickEdit\Schemas\Image;
use WP_UnitTestCase;

class ImageTest extends WP_UnitTestCase
{
    public function test_fields_returns_single_image_field()
    {
        $fields = (new Image())->fields();

        $this->assertCount(1, $fields);
        $this->assertSame('image', $fields[0]['key']);
        $this->assertSame('image', $fields[0]['control']);
    }

    public function test_apply_with_valid_id_derives_url_from_attachment_and_ignores_client_url()
    {
        $attId       = self::factory()->attachment->create_upload_object($this->writeStubPng());
        $expectedUrl = wp_get_attachment_image_url($attId, 'full');

        $html  = '<figure class="wp-block-image"><img src="/old.jpg" alt="old" class="wp-image-1" /></figure>';
        $block = $this->imageBlock($html, ['id' => 1]);

        // A hostile client url accompanies a real attachment id; the
        // server-derived url must win over what the client sent.
        $result = (new Image())->apply($block, 'image', [
            'url' => 'https://attacker.test/evil.jpg',
            'id'  => $attId,
            'alt' => 'new',
        ]);

        $this->assertSame($expectedUrl, $result['attrs']['url']);
        $this->assertSame($attId, $result['attrs']['id']);
        $this->assertStringContainsString('src="' . $expectedUrl . '"', $result['innerHTML']);
        $this->assertStringNotContainsString('attacker.test', $result['innerHTML']);
        $this->assertStringContainsString('alt="new"', $result['innerHTML']);
        // Exact class proves the stale wp-image-1 was replaced by the new id
        // (a substring check would trip on ids that start with "1").
        $this->assertStringContainsString('class="wp-image-' . $attId . '"', $result['innerHTML']);
    }

    public function test_apply_with_positive_but_invalid_id_returns_block_unchanged()
    {
        $html  = '<figure class="wp-block-image"><img src="/old.jpg" class="wp-image-1" /></figure>';
        $block = $this->imageBlock($html, ['id' => 1]);

        // id points at no real image attachment: reject the whole swap rather
        // than trusting the accompanying client url.
        $result = (new Image())->apply($block, 'image', [
            'url' => 'https://attacker.test/evil.jpg',
            'id'  => 999999,
        ]);

        $this->assertSame($block, $result);
    }

    public function test_apply_with_no_id_strips_srcset_and_sizes_for_url_only_swap()
    {
        $html  = '<figure><img src="/old.jpg" srcset="/old-2x.jpg 2x" sizes="100vw" class="wp-image-1" /></figure>';
        $block = $this->imageBlock($html, ['id' => 1]);

        $result = (new Image())->apply($block, 'image', [
            'url' => 'https://example.test/new.jpg',
        ]);

        $this->assertStringContainsString('src="https://example.test/new.jpg"', $result['innerHTML']);
        $this->assertStringNotContainsString('srcset=', $result['innerHTML']);
        $this->assertStringNotContainsString('sizes=', $result['innerHTML']);
        $this->assertStringNotContainsString('wp-image-', $result['innerHTML']);
        $this->assertArrayNotHasKey('id', $result['attrs']);
    }

    public function test_apply_strips_extendify_image_import_marker_from_figure()
    {
        $html  = '<figure class="wp-block-image extendify-image-import"><img src="/old.jpg" /></figure>';
        $block = $this->imageBlock($html);

        $result = (new Image())->apply($block, 'image', [
            'url' => 'https://example.test/new.jpg',
        ]);

        $this->assertStringNotContainsString('extendify-image-import', $result['innerHTML']);
        $this->assertStringContainsString('wp-block-image', $result['innerHTML']);
    }

    public function test_apply_idless_url_with_dangerous_scheme_leaves_block_unchanged()
    {
        $html  = '<figure class="wp-block-image"><img src="http://ok/a.jpg" alt="" /></figure>';

        foreach (['javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox(1)'] as $url) {
            $block  = $this->imageBlock($html);
            // esc_url_raw rejects the scheme → no usable url → swap is refused.
            $this->assertSame($block, (new Image())->apply($block, 'image', ['url' => $url]), "url: {$url}");
        }
    }

    public function test_apply_strips_tags_from_alt()
    {
        $html   = '<figure class="wp-block-image"><img src="http://ok/a.jpg" alt="" /></figure>';
        $result = (new Image())->apply($this->imageBlock($html), 'image', [
            'url' => 'https://example.test/new.jpg',
            'alt' => '<script>alert(1)</script>caption',
        ]);

        $this->assertStringContainsString('alt="caption"', $result['innerHTML']);
        $this->assertStringNotContainsString('<script', $result['innerHTML']);
    }

    public function test_apply_with_no_url_returns_block_unchanged()
    {
        $block = $this->imageBlock('<figure><img src="/old.jpg" /></figure>');

        $this->assertSame($block, (new Image())->apply($block, 'image', ['url' => '']));
        $this->assertSame($block, (new Image())->apply($block, 'image', []));
    }

    public function test_apply_with_non_array_value_returns_block_unchanged()
    {
        $block = $this->imageBlock('<figure><img src="/old.jpg" /></figure>');

        $this->assertSame($block, (new Image())->apply($block, 'image', 'just-a-string'));
    }

    public function test_apply_with_unknown_field_returns_block_unchanged()
    {
        $block = $this->imageBlock('<figure><img src="/old.jpg" /></figure>');

        $this->assertSame($block, (new Image())->apply($block, 'alt', 'just alt'));
    }

    private function imageBlock(string $innerHTML, array $attrs = []): array
    {
        return [
            'blockName'    => 'core/image',
            'attrs'        => $attrs,
            'innerBlocks'  => [],
            'innerHTML'    => $innerHTML,
            'innerContent' => [$innerHTML],
        ];
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
