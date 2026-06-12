<?php

namespace Extendify\Tests\Integration\QuickEdit\Services;

use Extendify\QuickEdit\Services\WPFormsTagger;
use WP_UnitTestCase;

// The tagger parses the rendered WPForms DOM pattern directly; it doesn't
// call any WPForms PHP. So these tests don't need WPForms loaded.
class WPFormsTaggerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
        set_current_screen('front');
    }

    public function test_init_registers_render_block_filter_at_priority_11_on_frontend()
    {
        remove_all_filters('render_block');

        WPFormsTagger::init();

        $this->assertSame(
            11,
            has_filter('render_block', [WPFormsTagger::class, 'onRenderBlock'])
        );
    }

    public function test_init_is_noop_in_admin_context()
    {
        remove_all_filters('render_block');
        set_current_screen('edit-post');

        WPFormsTagger::init();

        $this->assertFalse(has_filter('render_block', [WPFormsTagger::class, 'onRenderBlock']));
        set_current_screen('front');
    }

    public function test_tags_form_with_wpform_id()
    {
        $html = $this->renderForm(123);

        $tagged = WPFormsTagger::onRenderBlock($html, $this->wpformsBlock());

        $this->assertStringContainsString('data-extendify-quick-edit-wpform-id="123"', $tagged);
    }

    public function test_tags_each_field_container_with_its_field_id()
    {
        $html = '<form id="wpforms-form-7"><div id="wpforms-7-field_1-container"></div>'
            . '<div id="wpforms-7-field_2-container"></div>'
            . '<div id="wpforms-7-field_42-container"></div></form>';

        $tagged = WPFormsTagger::onRenderBlock($html, $this->wpformsBlock());

        $this->assertStringContainsString('data-extendify-quick-edit-wpform-field-id="1"', $tagged);
        $this->assertStringContainsString('data-extendify-quick-edit-wpform-field-id="2"', $tagged);
        $this->assertStringContainsString('data-extendify-quick-edit-wpform-field-id="42"', $tagged);
    }

    public function test_only_tags_fields_belonging_to_the_matched_form()
    {
        // Two forms in the same rendered HTML — only the first form's fields
        // should be tagged (the tagger keys on the captured formId).
        $html = '<form id="wpforms-form-1"><div id="wpforms-1-field_1-container"></div></form>'
            . '<form id="wpforms-form-2"><div id="wpforms-2-field_1-container"></div></form>';

        $tagged = WPFormsTagger::onRenderBlock($html, $this->wpformsBlock());

        $this->assertSame(
            1,
            substr_count($tagged, 'data-extendify-quick-edit-wpform-field-id="1"')
        );
    }

    public function test_unrelated_block_name_passes_through_unchanged()
    {
        $original = $this->renderForm(1);

        $tagged = WPFormsTagger::onRenderBlock($original, ['blockName' => 'core/paragraph']);

        $this->assertSame($original, $tagged);
    }

    public function test_empty_html_passes_through()
    {
        $this->assertSame('', WPFormsTagger::onRenderBlock('', $this->wpformsBlock()));
    }

    public function test_non_string_html_passes_through()
    {
        $this->assertNull(WPFormsTagger::onRenderBlock(null, $this->wpformsBlock()));
    }

    public function test_html_without_wpforms_form_pattern_is_unchanged()
    {
        $original = '<div class="not-a-wpform">no form id here</div>';

        $tagged = WPFormsTagger::onRenderBlock($original, $this->wpformsBlock());

        $this->assertSame($original, $tagged);
    }

    public function test_skips_when_logged_out()
    {
        wp_set_current_user(0);
        $original = $this->renderForm(1);

        $tagged = WPFormsTagger::onRenderBlock($original, $this->wpformsBlock());

        $this->assertSame($original, $tagged);
    }

    public function test_skips_when_user_lacks_required_capability()
    {
        $subscriber = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($subscriber);
        $original = $this->renderForm(1);

        $tagged = WPFormsTagger::onRenderBlock($original, $this->wpformsBlock());

        $this->assertSame($original, $tagged);
    }

    public function test_editor_user_does_not_tag_form()
    {
        // Locked down to Config::$requiredCapability (manage_options).
        // Editors don't see Quick Edit tagging on wpforms.
        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);

        $original = $this->renderForm(9);
        $tagged = WPFormsTagger::onRenderBlock($original, $this->wpformsBlock());

        $this->assertSame($original, $tagged);
    }

    public function test_does_not_double_tag_form()
    {
        $first  = WPFormsTagger::onRenderBlock($this->renderForm(5), $this->wpformsBlock());
        $second = WPFormsTagger::onRenderBlock($first, $this->wpformsBlock());

        $this->assertSame($first, $second);
        $this->assertSame(1, substr_count($second, 'data-extendify-quick-edit-wpform-id='));
    }

    public function test_does_not_double_tag_fields()
    {
        $html = '<form id="wpforms-form-1"><div id="wpforms-1-field_1-container"></div></form>';

        $first  = WPFormsTagger::onRenderBlock($html, $this->wpformsBlock());
        $second = WPFormsTagger::onRenderBlock($first, $this->wpformsBlock());

        $this->assertSame($first, $second);
        $this->assertSame(1, substr_count($second, 'data-extendify-quick-edit-wpform-field-id='));
    }

    private function renderForm(int $formId, string $extraBody = ''): string
    {
        return '<form id="wpforms-form-' . $formId . '" method="post">'
            . '<div id="wpforms-' . $formId . '-field_1-container">label</div>'
            . $extraBody
            . '</form>';
    }

    private function wpformsBlock(): array
    {
        return ['blockName' => 'wpforms/form-selector', 'attrs' => [], 'innerBlocks' => []];
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }
}
