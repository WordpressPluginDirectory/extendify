<?php

namespace Extendify\Agent;

defined('ABSPATH') || die('No direct access.');

// Resolves a block inside a template-part by the same preorder numbering
// TagTemplateParts assigns at render time, so a client blockId (read off a
// data-extendify-part-block-id attribute) maps back to the parsed block.
// Shared by SaveController (write) and WPController::getBlockCode (read) so the
// two halves can never resolve a different block for the same id.
class TemplatePartBlockFinder
{
    // Preorder walk matching TagTemplateParts numbering: nested
    // core/template-part blocks open a separate seq space (skipped), and the
    // shared $ignored dynamic blocks (mini-cart, loops, …) count as one leaf
    // each but are not descended into — the tagger skips their rendered subtree.
    //
    // Ref-based navigation blocks (`core/navigation` with a `ref` attr) resolve
    // their items at render time from a separate wp_navigation post.
    // TagTemplateParts fires for those rendered items inside the outer
    // template-part's frame, so each one increments the outer seq. parse_blocks
    // of the post we're walking only sees the navigation block (empty
    // innerBlocks for refs), so a naïve walk would under-count. Resolve the nav
    // ref here and add its block count to the running counter so blockIds
    // *after* the navigation (e.g. social-link in a sibling social-links block)
    // still line up.
    public static function find(
        array $blocks,
        int $targetId,
        int &$maxCounter = 0,
        array &$visited = []
    ) {
        $counter = 0;
        $found   = null;

        $walk = function (array &$list, array $pathSoFar)
 use (&$walk, &$counter, &$found, $targetId, &$visited) {
            foreach ($list as $i => &$block) {
                if ($found !== null) {
                    return;
                }
                $name = $block['blockName'] ?? '';
                if ($name === '') {
                    if (!empty($block['innerBlocks'])) {
                        $walk($block['innerBlocks'], array_merge($pathSoFar, [$i, 'innerBlocks']));
                    }
                    continue;
                }
                if ($name === 'core/template-part') {
                    continue;
                }
                $counter++;
                $visited[] = ['c' => $counter, 'n' => $name];
                if ($counter === $targetId) {
                    $found = ['block' => $block, 'path' => array_merge($pathSoFar, [$i])];
                    return;
                }
                // Dynamic self-rendering blocks (loops, woocommerce/mini-cart, …)
                // count as one leaf but are not descended into: TagTemplateParts
                // skips their render-injected subtree, so descending here would
                // drift every later id. Shares the one $ignored list.
                if (in_array($name, TagTemplateParts::$ignored, true)) {
                    continue;
                }
                if ($name === 'core/navigation' && !empty($block['attrs']['ref'])) {
                    $navPost = get_post((int) $block['attrs']['ref']);
                    if ($navPost) {
                        $navBlocks = parse_blocks($navPost->post_content);
                        $before = $counter;
                        self::countBlocksPreorder($navBlocks, $counter);
                        for ($j = $before + 1; $j <= $counter; $j++) {
                            $visited[] = ['c' => $j, 'n' => '(nav-ref-item)'];
                        }
                    }
                    // Ref navs have no innerBlocks in the parsed tree — items
                    // live in the wp_navigation post and can't be replaced from
                    // here anyway (WPNavigationController owns that).
                    continue;
                }
                if (!empty($block['innerBlocks'])) {
                    $walk($block['innerBlocks'], array_merge($pathSoFar, [$i, 'innerBlocks']));
                }
            }
            unset($block);
        };
        $walk($blocks, []);
        $maxCounter = $counter;

        return $found;
    }

    private static function countBlocksPreorder(array $blocks, int &$counter)
    {
        foreach ($blocks as $block) {
            $name = $block['blockName'] ?? '';
            if ($name === '') {
                if (!empty($block['innerBlocks'])) {
                    self::countBlocksPreorder($block['innerBlocks'], $counter);
                }
                continue;
            }
            if ($name === 'core/template-part') {
                continue;
            }
            $counter++;
            if (in_array($name, TagTemplateParts::$ignored, true)) {
                continue;
            }
            if (!empty($block['innerBlocks'])) {
                self::countBlocksPreorder($block['innerBlocks'], $counter);
            }
        }
    }
}
