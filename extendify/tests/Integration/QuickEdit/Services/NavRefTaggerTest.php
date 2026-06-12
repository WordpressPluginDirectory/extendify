<?php

namespace Extendify\Tests\Integration\QuickEdit\Services;

use Extendify\QuickEdit\Services\NavRefTagger;
use ReflectionClass;
use WP_UnitTestCase;

class NavRefTaggerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
        NavRefTagger::reset();
    }

    public function tearDown(): void
    {
        NavRefTagger::reset();
        parent::tearDown();
    }

    public function test_init_registers_three_hooks_at_their_priorities()
    {
        remove_all_filters('template_redirect');
        remove_all_filters('pre_render_block');
        remove_all_filters('render_block');

        NavRefTagger::init();

        $this->assertSame(10, has_action('template_redirect', [NavRefTagger::class, 'reset']));
        $this->assertSame(10, has_filter('pre_render_block', [NavRefTagger::class, 'onPreRenderBlock']));
        $this->assertSame(9, has_filter('render_block', [NavRefTagger::class, 'onRenderBlock']));
    }

    public function test_navigation_wrapper_gets_ref_attr()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(42));
        $html = NavRefTagger::onRenderBlock('<nav class="wp-block-navigation"></nav>', $this->navBlock(42));

        $this->assertStringContainsString('data-extendify-quick-edit-nav-ref="42"', $html);
    }

    public function test_navigation_with_ref_zero_is_not_tagged()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(0));
        $html = NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(0));

        $this->assertSame('<nav></nav>', $html);
    }

    public function test_navigation_with_missing_ref_attr_is_not_tagged()
    {
        $block = ['blockName' => 'core/navigation', 'attrs' => [], 'innerBlocks' => []];
        NavRefTagger::onPreRenderBlock(null, $block);
        $html = NavRefTagger::onRenderBlock('<nav></nav>', $block);

        $this->assertSame('<nav></nav>', $html);
    }

    public function test_navigation_ref_is_cast_to_int_when_attr_is_string()
    {
        $block = ['blockName' => 'core/navigation', 'attrs' => ['ref' => '17'], 'innerBlocks' => []];
        NavRefTagger::onPreRenderBlock(null, $block);
        $html = NavRefTagger::onRenderBlock('<nav></nav>', $block);

        $this->assertStringContainsString('data-extendify-quick-edit-nav-ref="17"', $html);
    }

    public function test_pre_render_block_never_short_circuits()
    {
        $sentinel = (object) ['x' => 1];

        $result = NavRefTagger::onPreRenderBlock($sentinel, $this->navBlock(7));

        $this->assertSame($sentinel, $result);
    }

    public function test_pre_render_block_ignores_non_navigation_blocks()
    {
        $depthBefore = $this->stackDepth();

        NavRefTagger::onPreRenderBlock(null, ['blockName' => 'core/paragraph']);

        $this->assertSame($depthBefore, $this->stackDepth());
    }

    public function test_navigation_link_items_get_sequential_zero_based_indexes()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));

        $first  = NavRefTagger::onRenderBlock('<li><a>Home</a></li>', $this->linkBlock());
        $second = NavRefTagger::onRenderBlock('<li><a>About</a></li>', $this->linkBlock());
        $third  = NavRefTagger::onRenderBlock('<li><a>Contact</a></li>', $this->linkBlock());

        $this->assertStringContainsString('data-extendify-quick-edit-nav-item-index="0"', $first);
        $this->assertStringContainsString('data-extendify-quick-edit-nav-item-index="1"', $second);
        $this->assertStringContainsString('data-extendify-quick-edit-nav-item-index="2"', $third);
    }

    public function test_navigation_submenu_is_tagged_like_a_link()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));

        $html = NavRefTagger::onRenderBlock(
            '<li class="has-children"><a>More</a></li>',
            $this->submenuBlock()
        );

        $this->assertStringContainsString('data-extendify-quick-edit-nav-item-index="0"', $html);
    }

    public function test_link_outside_any_navigation_frame_is_unchanged()
    {
        $original = '<li><a>orphan</a></li>';

        $html = NavRefTagger::onRenderBlock($original, $this->linkBlock());

        $this->assertSame($original, $html);
    }

    public function test_nested_navigations_use_independent_counters()
    {
        // Simulates the real render order: outer pre → outer link → inner pre
        // → inner link → inner render_block → outer link → outer render_block.
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));
        $outerFirst = NavRefTagger::onRenderBlock('<li><a>Outer A</a></li>', $this->linkBlock());

        NavRefTagger::onPreRenderBlock(null, $this->navBlock(2));
        $innerFirst  = NavRefTagger::onRenderBlock('<li><a>Inner A</a></li>', $this->linkBlock());
        $innerSecond = NavRefTagger::onRenderBlock('<li><a>Inner B</a></li>', $this->linkBlock());
        NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(2));

        $outerSecond = NavRefTagger::onRenderBlock('<li><a>Outer B</a></li>', $this->linkBlock());

        $this->assertStringContainsString('nav-item-index="0"', $outerFirst);
        $this->assertStringContainsString('nav-item-index="0"', $innerFirst);
        $this->assertStringContainsString('nav-item-index="1"', $innerSecond);
        // Outer counter survived the inner navigation: continues at 1, not reset to 0.
        $this->assertStringContainsString('nav-item-index="1"', $outerSecond);
    }

    public function test_navigation_render_block_pops_the_stack_frame()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));
        $this->assertSame(1, $this->stackDepth());

        NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(1));

        $this->assertSame(0, $this->stackDepth());
    }

    public function test_reset_clears_the_stack()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(2));
        $this->assertSame(2, $this->stackDepth());

        NavRefTagger::reset();

        $this->assertSame(0, $this->stackDepth());
    }

    public function test_skips_in_admin_context()
    {
        set_current_screen('edit-post');
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));

        $html = NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(1));

        $this->assertSame('<nav></nav>', $html);
        set_current_screen('front');
    }

    public function test_skips_when_logged_out()
    {
        wp_set_current_user(0);
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));

        $html = NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(1));

        $this->assertSame('<nav></nav>', $html);
    }

    public function test_skips_when_user_lacks_required_capability()
    {
        $subscriber = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($subscriber);

        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));
        $html = NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(1));

        $this->assertSame('<nav></nav>', $html);
    }

    public function test_editor_user_does_not_tag_nav()
    {
        // Locked down with the admin-bar pill: NavRefTagger now gates on
        // Config::$requiredCapability (manage_options), so editors who
        // have edit_posts but not manage_options no longer get tagged DOM.
        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);

        NavRefTagger::onPreRenderBlock(null, $this->navBlock(9));
        $html = NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(9));

        $this->assertSame('<nav></nav>', $html);
    }

    public function test_empty_html_passes_through()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(1));

        $this->assertSame('', NavRefTagger::onRenderBlock('', $this->navBlock(1)));
    }

    public function test_does_not_double_tag_navigation()
    {
        NavRefTagger::onPreRenderBlock(null, $this->navBlock(5));
        $first  = NavRefTagger::onRenderBlock('<nav></nav>', $this->navBlock(5));

        NavRefTagger::onPreRenderBlock(null, $this->navBlock(5));
        $second = NavRefTagger::onRenderBlock($first, $this->navBlock(5));

        $this->assertSame(1, substr_count($second, 'data-extendify-quick-edit-nav-ref='));
    }

    private function navBlock(int $ref): array
    {
        return [
            'blockName'   => 'core/navigation',
            'attrs'       => ['ref' => $ref],
            'innerBlocks' => [],
        ];
    }

    private function linkBlock(): array
    {
        return ['blockName' => 'core/navigation-link', 'attrs' => [], 'innerBlocks' => []];
    }

    private function submenuBlock(): array
    {
        return ['blockName' => 'core/navigation-submenu', 'attrs' => [], 'innerBlocks' => []];
    }

    private function stackDepth(): int
    {
        $reflection = new ReflectionClass(NavRefTagger::class);
        $prop = $reflection->getProperty('navStack');
        $prop->setAccessible(true);
        return count($prop->getValue());
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }
}
