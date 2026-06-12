<?php

namespace Extendify\Tests\Integration\QuickEdit\Services;

use Extendify\QuickEdit\Services\MediaTextTagger;
use WP_UnitTestCase;

// The tagger parses the rendered core/media-text DOM directly; it doesn't call
// any block PHP. So these tests render the markup inline.
class MediaTextTaggerTest extends WP_UnitTestCase
{
    private const ATTR = 'data-extendify-quick-edit-mediatext-media';

    public function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
        set_current_screen('front');
    }

    public function test_init_registers_render_block_filter_at_priority_11()
    {
        remove_all_filters('render_block');

        MediaTextTagger::init();

        $this->assertSame(
            11,
            has_filter('render_block', [MediaTextTagger::class, 'tag'])
        );
    }

    // The regression: Extendify-imported media-text blocks keep the image URL
    // only in the <img> markup, with no mediaUrl / mediaId block attrs. The
    // tagger must still mark the figure so the front-end selector can resolve a
    // click to a media-text image edit.
    public function test_tags_imported_figure_without_media_attrs()
    {
        $tagged = MediaTextTagger::tag(
            $this->renderImported(),
            $this->block(['mediaType' => 'image', 'className' => 'extendify-image-import'])
        );

        $this->assertStringContainsString(self::ATTR . '="1"', $tagged);
    }

    public function test_tags_standard_figure_with_media_attrs()
    {
        $tagged = MediaTextTagger::tag(
            $this->renderStandard(42),
            $this->block(['mediaType' => 'image', 'mediaId' => 42, 'mediaUrl' => 'https://x/y.jpg'])
        );

        $this->assertStringContainsString(self::ATTR . '="1"', $tagged);
    }

    public function test_skips_video_media_type()
    {
        $original = $this->renderImported();

        $tagged = MediaTextTagger::tag($original, $this->block(['mediaType' => 'video']));

        $this->assertSame($original, $tagged);
    }

    public function test_skips_figure_without_image()
    {
        $original = '<div class="wp-block-media-text">'
            . '<figure class="wp-block-media-text__media"></figure>'
            . '<div class="wp-block-media-text__content"><p>text</p></div></div>';

        $tagged = MediaTextTagger::tag($original, $this->block(['mediaType' => 'image']));

        $this->assertSame($original, $tagged);
    }

    public function test_unrelated_block_name_passes_through_unchanged()
    {
        $original = $this->renderImported();

        $tagged = MediaTextTagger::tag($original, ['blockName' => 'core/cover', 'attrs' => []]);

        $this->assertSame($original, $tagged);
    }

    public function test_empty_html_passes_through()
    {
        $this->assertSame('', MediaTextTagger::tag('', $this->block()));
    }

    public function test_non_string_html_passes_through()
    {
        $this->assertNull(MediaTextTagger::tag(null, $this->block()));
    }

    public function test_skips_when_logged_out()
    {
        wp_set_current_user(0);
        $original = $this->renderImported();

        $tagged = MediaTextTagger::tag($original, $this->block());

        $this->assertSame($original, $tagged);
    }

    public function test_skips_when_user_lacks_required_capability()
    {
        $subscriber = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($subscriber);
        $original = $this->renderImported();

        $tagged = MediaTextTagger::tag($original, $this->block());

        $this->assertSame($original, $tagged);
    }

    public function test_editor_user_does_not_tag()
    {
        // Locked down to Config::$requiredCapability (manage_options).
        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $original = $this->renderImported();

        $tagged = MediaTextTagger::tag($original, $this->block());

        $this->assertSame($original, $tagged);
    }

    public function test_does_not_double_tag()
    {
        $first  = MediaTextTagger::tag($this->renderImported(), $this->block());
        $second = MediaTextTagger::tag($first, $this->block());

        $this->assertSame($first, $second);
        $this->assertSame(1, substr_count($second, self::ATTR . '='));
    }

    private function renderImported(): string
    {
        return '<div class="wp-block-media-text is-image-fill-element extendify-image-import">'
            . '<figure class="wp-block-media-text__media">'
            . '<img src="https://images.unsplash.com/photo-x" alt="" style="object-position:50% 50%"/>'
            . '</figure>'
            . '<div class="wp-block-media-text__content"><p>text</p></div></div>';
    }

    private function renderStandard(int $id): string
    {
        return '<div class="wp-block-media-text">'
            . '<figure class="wp-block-media-text__media">'
            . '<img src="https://x/y.jpg" alt="" class="wp-image-' . $id . ' size-full"/>'
            . '</figure>'
            . '<div class="wp-block-media-text__content"><p>text</p></div></div>';
    }

    private function block(array $attrs = ['mediaType' => 'image']): array
    {
        return ['blockName' => 'core/media-text', 'attrs' => $attrs, 'innerBlocks' => []];
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }
}
