<?php

/**
 * WP Controller
 */

namespace Extendify\Agent\Controllers;

defined('ABSPATH') || die('No direct access.');

/**
 * The controller for interacting with WordPress.
 */

class WPController
{
    public static $ignoredKeys = [
        'title',
        '$schema',
        'version',
        'slug',
    ];

    public static $allowedVariationsList = [
        'bloom',
        'brick',
        'cobalt',
        'coral',
        'evergreen',
        'gold',
        'lilac',
        'lime',
        'midnight',
        'moss',
        'neon',
        'rosewood',
        'slate',
        'onyx',
        'glasgow',
        'royal',
        'obsidian',
    ];


    /**
     * Recursively filter an array to include only specified properties.
     *
     * This function traverses the array structure and retains only the properties
     * specified in the allowed keys, preserving the original hierarchical structure.
     * Keys that don't match the allowed set are excluded from the result.
     *
     * @param array $data The input array to filter
     * @param array $allowedKeys Associative array of allowed property keys (keys as indices)
     * @return array             Filtered array containing only allowed properties, maintaining structure
     */
    protected static function filterArrayByProperties(array $data, array $allowedKeys)
    {
        if (empty($allowedKeys) || empty($data)) {
            return [];
        }

        $result = [];
        foreach ($data as $key => $value) {
            if (isset($allowedKeys[$key])) {
                $result[$key] = $value;
            } elseif (is_array($value)) {
                // Recursively filter nested arrays
                $filtered = self::filterArrayByProperties($value, $allowedKeys);
                if (!empty($filtered)) {
                    $result[$key] = $filtered;
                }
            }
        }

        return $result;
    }

    /**
     * Validates if a variation contains only specified properties.
     *
     * This function checks whether the variation array contains exclusively the
     * specified properties throughout its entire hierarchy.
     *
     * @param array $variation The theme variation arrays to validate
     * @param array $allowedKeys List of property names that should be the only ones present
     * @return bool           TRUE if only specified properties exist, FALSE otherwise
     */
    protected static function variationHasProperties(array $variation, array $allowedKeys)
    {
        if (empty($variation) || empty($allowedKeys)) {
            return false;
        }

        $allowedKeys = array_flip($allowedKeys);
        $data  = array_diff_key($variation, array_flip(self::$ignoredKeys));
        $filtered = self::filterArrayByProperties($data, $allowedKeys);

        return serialize($filtered) === serialize($data);
    }
    /**
     * Get Theme Variations and the compiled CSS for each variation.
     *
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response
     */
    public static function getVariations($request)
    {
        $includeLayoutStyles = $request->has_param('includeLayoutStyles');
        $current = \WP_Theme_JSON_Resolver::get_merged_data();
        $unfiltered = \WP_Theme_JSON_Resolver::get_style_variations();

        $variations = array_filter($unfiltered, function ($variation) {
            return self::variationHasProperties($variation, ['color']);
        });

        $buildSlugMap = function ($unfiltered) {
            $slugMap = [];

            if (!is_array($unfiltered)) {
                return $slugMap;
            }

            foreach ($unfiltered as $rawSlug => $rawVariation) {
                $title = is_array($rawVariation) ? ($rawVariation['title'] ?? null) : null;
                $slug = is_array($rawVariation)
                    ? ($rawVariation['slug'] ?? (is_string($rawSlug) ? $rawSlug : null))
                    : null;

                if ($title && $slug && !isset($slugMap[$title])) {
                    $slugMap[$title] = $slug;
                }
            }
            return $slugMap;
        };
        $slugMap = $buildSlugMap($unfiltered);
        array_walk($variations, function (&$variation) use ($slugMap) {
            if (!is_array($variation) || isset($variation['slug'])) {
                return;
            }

            $title = $variation['title'] ?? null;
            if ($title && isset($slugMap[$title])) {
                $variation['slug'] = $slugMap[$title];
            }
        });

        $deduped = [];
        foreach ($variations as $variation) {
            $title = $variation['title'] ?? null;
            if (!$title || isset($deduped[$title])) {
                continue;
            }
            $theme = new \WP_Theme_JSON();
            $theme->merge($current);
            $theme->merge(new \WP_Theme_JSON($variation));
            $css = $theme->get_stylesheet(
                ["variables", "styles", "presets"],
                null,
                ["skip_root_layout_styles" => !$includeLayoutStyles, 'include_block_style_variations' => true]
            );
            $variation['css'] = $css;
            array_push($deduped, $variation);
        }

        // if the theme is extendable we need to filter the variations using the allowed variations list
        if (\get_option('stylesheet') === 'extendable') {
            $deduped = array_filter($deduped, function ($variation) {
                return in_array($variation['slug'], self::$allowedVariationsList);
            });
        }

        return new \WP_REST_Response(array_values($deduped));
    }

    /**
     * Get the HTML of a specific tagged block code
     *
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response
     */
    public static function getBlockCode($request)
    {
        $blockId = $request->get_param('blockId');
        $postId = $request->get_param('postId');
        $post = \get_post($postId);
        $ast = array_filter(
            parse_blocks($post->post_content),
            function ($block) {
                return isset($block['blockName']);
            }
        );
        $seq = 0;
        $found = null;
        $walk = function (array $list) use (&$walk, &$seq, $blockId, &$found) {
            foreach ($list as $b) {
                $seq++;
                if ($seq === (int) $blockId) {
                    $found = $b;
                    return true;
                }

                if (!empty($b['innerBlocks']) && $walk($b['innerBlocks'])) {
                    return true;
                }
            }
            return false;
        };
        $walk($ast);

        return new \WP_REST_Response(['block' => serialize_block($found)]);
    }

    /**
     * Get the rendered HTML of some block code
     *
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response
     */
    public static function getBlockHtml($request)
    {
        $blockCode = $request->get_param('blockCode');
        $content = \do_blocks($blockCode);

        return new \WP_REST_Response(['content' => $content]);
    }
}
