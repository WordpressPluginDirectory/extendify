<?php

namespace Extendify\Agent;

defined('ABSPATH') || die('No direct access.');

// Preorder numbering, per template-part scope.
class TagTemplateParts
{
    // Dynamic self-rendering blocks: their rendered output contains blocks that
    // aren't in the parsed tree (a mini-cart drawer, a loop's per-item copies),
    // so counting that output inflates every later id beyond what the static
    // TemplatePartBlockFinder can resolve. Each is counted as one opaque leaf
    // here and its rendered subtree skipped; the finder shares this list and
    // treats them as leaves too (counted, not descended into).
    public static $ignored = [
        'core/query',
        'core/post-template',
        'core/post-content',
        'core/comments',
        'core/comment-template',
        'woocommerce/product-collection',
        'woocommerce/product-template',
        'woocommerce/mini-cart',
        'woocommerce/cart',
        'woocommerce/checkout',
    ];

    private static $frames = [];
    // Entries keyed by block-name; see onRenderBlock for why a plain stack lost
    // tags on nav items 5+.
    private static $blockStack = [];

    public static function init()
    {
        add_action('template_redirect', [self::class, 'reset']);
        add_filter('render_block_data', [self::class, 'onRenderBlockData'], 10, 2);
        add_filter('render_block', [self::class, 'onRenderBlock'], 10, 2);
    }

    public static function reset()
    {
        self::$frames = [];
        self::$blockStack = [];
    }

    private static function isTemplatePart(array $b): bool
    {
        return (($b['blockName'] ?? '') === 'core/template-part');
    }

    private static function currentFrame()
    {
        return self::$frames ? self::$frames[count(self::$frames) - 1] : null;
    }

    private static function setCurrentFrame(array $frame)
    {
        self::$frames[count(self::$frames) - 1] = $frame;
    }

    private static function labelForPart(array $b): string
    {
        if (!empty($b['attrs']['area'])) {
            return (string) $b['attrs']['area'];
        }
        if (!empty($b['attrs']['slug'])) {
            return (string) $b['attrs']['slug'];
        }
        return 'template-part';
    }

    public static function onRenderBlockData(array $block, array $source): array
    {
        $name = $block['blockName'] ?? '';
        if ($name === '') {
            return $block;
        }

        if (self::isTemplatePart($block)) {
            self::$frames[] = [
                'label' => self::labelForPart($block),
                'slug' => $block['attrs']['slug'] ?? '',
                'seq' => 0,
                'skip_depth' => 0,
            ];
            $block['attrs']['__extendify_scope_open'] = 1;
            return $block;
        }

        if (empty(self::$frames)) {
            return $block;
        }

        $frame = self::currentFrame();
        if (!$frame) {
            return $block;
        }

        // render_block_data runs top-down (before a block's own render), so an
        // ignored block is counted here as a leaf and the skip is raised *after*
        // — its descendants then render with skip_depth > 0 and are not counted.
        if (($frame['skip_depth'] ?? 0) === 0) {
            $frame['seq']++;
            self::$blockStack[] = [
                'name' => $name,
                'id' => $frame['seq'],
                'label' => $frame['label'],
                'slug' => $frame['slug'] ?? '',
            ];
        }
        if (in_array($name, self::$ignored, true)) {
            $frame['skip_depth'] = ($frame['skip_depth'] ?? 0) + 1;
        }
        self::setCurrentFrame($frame);

        return $block;
    }

    public static function onRenderBlock(string $html, array $block): string
    {
        $name = $block['blockName'] ?? '';
        if ($name === '') {
            return $html;
        }

        if (self::isTemplatePart($block) && !empty($block['attrs']['__extendify_scope_open'])) {
            array_pop(self::$frames);
            return $html;
        }

        if (empty(self::$frames)) {
            return $html;
        }

        $frame = self::currentFrame();
        $skip = $frame['skip_depth'] ?? 0;

        // render_block runs bottom-up, so the ignored block's own filter fires
        // after its descendants — drop one skip level here. Only the outermost
        // ignored block (skip === 1) was counted in render_block_data, so only it
        // falls through to be stamped; nested ones and descendants bail.
        if (in_array($name, self::$ignored, true)) {
            $frame['skip_depth'] = max(0, $skip - 1);
            self::setCurrentFrame($frame);
            if ($skip > 1) {
                return $html;
            }
        } elseif ($skip > 0) {
            return $html;
        }

        // Name-keyed lookup, not array_pop: core/navigation fires render_block
        // for inner items without firing render_block_data first, so a
        // straight pop would consume entries belonging to unrelated outer
        // blocks. If nothing matches, mint a fresh id (nav-link/-submenu path).
        $info = null;
        $infoIndex = -1;
        for ($i = count(self::$blockStack) - 1; $i >= 0; $i--) {
            if (self::$blockStack[$i]['name'] === $name) {
                $info = self::$blockStack[$i];
                $infoIndex = $i;
                break;
            }
        }
        if ($info !== null) {
            array_splice(self::$blockStack, $infoIndex, 1);
        } else {
            $frame = self::currentFrame();
            if ($frame) {
                $frame['seq']++;
                self::setCurrentFrame($frame);
                $info = [
                    'name'  => $name,
                    'id'    => $frame['seq'],
                    'label' => $frame['label'],
                    'slug'  => $frame['slug'] ?? '',
                ];
            }
        }

        if ($info && $html) {
            $tp = new \WP_HTML_Tag_Processor($html);
            if ($tp->next_tag()) {
                $tp->set_attribute('data-extendify-part-block-id', (string) (int) $info['id']);
                $tp->set_attribute('data-extendify-part', $info['label']);
                if (!empty($info['slug'])) {
                    $tp->set_attribute('data-extendify-part-slug', $info['slug']);
                }
                $html = $tp->get_updated_html();
            }
        }
        return $html;
    }
}
