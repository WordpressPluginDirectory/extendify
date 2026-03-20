<?php

/**
 * WP Controller
 */

namespace Extendify\Agent\Controllers;

defined('ABSPATH') || die('No direct access.');

use Extendify\Shared\Services\Sanitizer;

/**
 * The controller for interacting with WordPress.
 */

class WPController
{
    /**
     * $ignoredKeys are only removed top-level (line 94) and not recursively
     *
     * @var string[]
     */
    public static $ignoredKeys = [
        'title',
        '$schema',
        'version',
        'slug',
    ];
    /**
     * Allowed variations for the extendable theme
     *
     * @var string[]
     */
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
     * Get the CSS for each variation.
     *
     * @param array $variations The theme variations to process.
     * @param \WP_Theme_JSON $current The current theme JSON data.
     * @param bool $includeLayoutStyles Whether to include layout styles in the CSS.
     * @return array The variations with their corresponding CSS.
     */
    protected static function getCss($variations, $current, $includeLayoutStyles)
    {
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
            // to make sure we exit early
            $deduped[$title] = $variation;
        }

        return array_values($deduped);
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

        $deduped = static::getCss($variations, $current, $includeLayoutStyles);
        // if the theme is extendable we need to filter the variations using the allowed variations list
        if (\get_option('stylesheet') === 'extendable') {
            $deduped = array_filter($deduped, function ($variation) {
                return in_array($variation['slug'], self::$allowedVariationsList);
            });
        }


        return new \WP_REST_Response(array_values($deduped));
    }

    /**
     * Get Theme fonts Variations and the compiled CSS for each variation.
     *
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response
     */
    public static function getFontsVariations($request)
    {
        $includeLayoutStyles = $request->has_param('includeLayoutStyles');
        $current = \WP_Theme_JSON_Resolver::get_merged_data();
        $unfiltered = \WP_Theme_JSON_Resolver::get_style_variations();

        $fontsVariations = array_filter($unfiltered, function ($variation) {
            return self::variationHasProperties($variation, ['elements', 'typography']);
        });

        $processedFonts = array_map(function ($variation) {
            if (!isset($variation['styles']['elements']) || !is_array($variation['styles']['elements'])) {
                return $variation;
            }

            $variation['styles']['elements'] = array_map(
                [self::class, 'normalizeElementTypography'],
                $variation['styles']['elements']
            );

            if (!isset($variation['styles']['typography'])) {
                $variation['styles']['typography'] = [
                    'fontFamily' => 'var(--wp--preset--font-family--inter)'
                ];
            }

            // Removing the settings that cause the style to change.
            unset($variation['settings']);

            return $variation;
        }, $fontsVariations);

        $deduped = static::getCss($processedFonts, $current, $includeLayoutStyles);
        return new \WP_REST_Response($deduped);
    }

    /**
     * Get block style variations (vibes) from merged global styles
     *
     * @param \WP_REST_Request $request The request.
     * @return \WP_REST_Response
     */
    public static function getBlockStyleVariations($request)
    {
        // Get theme + DB merged Global Styles
        $merged = wp_get_global_styles();
        $blocks = $merged['blocks'] ?? [];

        $variations = [];

        foreach ($blocks as $blockName => $blockData) {
            if (!isset($blockData['variations'])) {
                continue;
            }

            $variations[$blockName] = $blockData['variations'];
        }

        return new \WP_REST_Response($variations, 200);
    }

    /**
     * Normalize typography properties for theme element styles.
     *
     * @param array $elementStyles The element styles array containing typography configuration
     * @return array Normalized typography properties with filtered null values
     */
    protected static function normalizeElementTypography(array $elementStyles)
    {
        $typography = $elementStyles['typography'] ?? [];

        return [
            'typography' => array_filter([
                'fontFamily' => $typography['fontFamily'] ?? null,
                'fontSize' => $typography['fontSize'] ?? null,
                'lineHeight' => $typography['lineHeight'] ?? null,
                'letterSpacing' => $typography['letterSpacing'] ?? null,
                'fontStyle' => $typography['fontStyle'] ?? null,
                'fontWeight' => $typography['fontWeight'] ?? null,
                'textTransform' => $typography['textTransform'] ?? 'none',
            ], function ($v) {
                return $v !== null;
            })
        ];
    }


    /**
     * Get the HTML of a specific tagged block code
     *
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response
     */
    public static function getBlockCode(\WP_REST_Request $request)
    {
        $blockId = (int) $request->get_param('blockId');
        $postId  = (int) $request->get_param('postId');

        if ($blockId < 1) {
            return new \WP_REST_Response(['error' => 'Invalid blockId'], 400);
        }

        $post = \get_post($postId);
        if (!$post) {
            return new \WP_REST_Response(['error' => 'Post not found'], 404);
        }

        $ignored = ['core/query', 'core/post-template', 'core/post-content'];

        $ast = array_values(array_filter(
            parse_blocks($post->post_content),
            static function ($b) {
                return is_array($b) && !empty($b['blockName']);
            }
        ));

        $seq = 0;
        $found = null;

        $walk = function (array $list) use (&$walk, &$seq, $blockId, &$found, $ignored) {
            foreach ($list as $b) {
                $name = $b['blockName'] ?? null;
                if (!$name) {
                    continue;
                }

                // Ignore this block and its subtree (matches tagger behavior)
                if (in_array($name, $ignored, true)) {
                    continue; // do NOT increment seq, do NOT traverse children
                }

                $seq++;
                if ($seq === $blockId) {
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

        if (!is_array($found) || empty($found['blockName'])) {
            return new \WP_REST_Response(['error' => 'Block id not found in this post'], 404);
        }

        return new \WP_REST_Response([
            'postId'  => $postId,
            'blockId' => $blockId,
            'name'    => $found['blockName'],
            'attrs'   => $found['attrs'] ?? (object)[],
            'block'   => serialize_blocks([$found]),
        ], 200);
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

        return new \WP_REST_Response(['content' => trim($content)]);
    }

    protected static function getHeroPatternsData($title, $description, $images, $cta)
    {
        $response = \wp_remote_post(
            'https://patterns.extendify.com/api/heros',
            [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept'       => 'application/json',
                ],
                'body' => wp_json_encode([
                    "wpVersion" => \get_bloginfo('version'),
                    "wpLanguage" => \get_locale(),
                ])
            ]
        );

        if (\is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(\wp_remote_retrieve_body($response), true);

        $heroPatterns = array_map(
            function ($heroPattern) use ($description, $title, $images, $cta) {
                $code = $heroPattern['code'] ?? '';

                if ($title) {
                    $code = preg_replace(
                        '/(<!-- wp:heading[^>]*-->[\s\S]*?<h1[^>]*>)[\s\S]*?(<\/h1>[\s\S]*?<!-- \/wp:heading -->)/m',
                        '${1}' . esc_html($title) . '${2}',
                        $code,
                        1
                    );
                }

                if ($description) {
                    $code = preg_replace(
                        '/(<!-- wp:paragraph[^>]*-->[\s\S]*?<p[^>]*>)[\s\S]*?(<\/p>[\s\S]*?<!-- \/wp:paragraph -->)/m',
                        '${1}' . esc_html($description) . '${2}',
                        $code,
                        1
                    );
                }

                if ($cta['label'] ?? null) {
                    $code = preg_replace(
                        '/(<!-- wp:button[^>]*-->[\s\S]*?<a[^>]*>)[\s\S]*?(<\/a>[\s\S]*?<!-- \/wp:button -->)/m',
                        '${1}' . esc_html($cta['label']) . '${2}',
                        $code,
                        1
                    );
                }

                if ($cta['link'] ?? null) {
                    $code = preg_replace(
                        '/(<!-- wp:button[\s\S]*?<a[^>]*\shref=")[^"]*(")/m',
                        '${1}' . esc_url($cta['link']) . '${2}',
                        $code,
                        1
                    );
                }

                foreach ($heroPattern['urls'] ?? [] as $key => $url) {
                    if (!($images[$key] ?? null)) {
                        break;
                    }

                    $code = str_replace($url, $images[$key], $code);
                }

                $renderedHtml = do_blocks(str_replace('ext-animate--on', '', $code));

                $blockSupportsCss = function_exists('wp_style_engine_get_stylesheet_from_context')
                    ? wp_style_engine_get_stylesheet_from_context('block-supports')
                    : '';

                // Clear block-supports store so CSS doesn't accumulate across patterns.
                \WP_Style_Engine_CSS_Rules_Store::remove_all_stores();

                $linkStyles = array_values(
                    array_filter(
                        array_map(
                            function ($style) {
                                return wp_styles()->registered[$style]->src ?? null;
                            },
                            wp_styles()->queue ?? []
                        )
                    )
                );

                /**
                 * Clear queue for the next pattern.
                 *
                 * `do_blocks` appends to the global queue the styles needed for the blocks.
                 */
                wp_styles()->queue = [];

                return [
                    'id'               => $heroPattern['id'],
                    'code'             => $code,
                    'renderedHtml'     => $renderedHtml,
                    'blockSupportsCss' => $blockSupportsCss,
                    'linkStyles'       => $linkStyles,
                ];
            },
            $body
        );

        return $heroPatterns;
    }

    /**
     * Get the Hero Patterns
     *
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response
     */
    public static function getHeroPatterns(\WP_REST_Request $request)
    {
        $title = $request->get_param('title');
        $description = $request->get_param('description');
        $images = $request->get_param('images');
        $cta = $request->get_param('cta');

        $heroPatterns = self::getHeroPatternsData($title, $description, $images, $cta);

        if (\is_wp_error($heroPatterns)) {
            return new \WP_REST_Response([], 500);
        }

        $blockEditorContext = new \WP_Block_Editor_Context(array( 'name' => 'core/edit-post' ));
        $editorSettings = get_block_editor_settings([], $blockEditorContext);

        return new \WP_REST_Response(['patterns' => $heroPatterns, 'blockEditorSettings' => $editorSettings ?? null]);
    }

    public static function getSiteDesignVariations(\WP_REST_Request $request)
    {
        $title = $request->get_param('title');
        $description = $request->get_param('description');
        $images = $request->get_param('images');
        $cta = $request->get_param('cta');

        $heroPatterns = self::getHeroPatternsData($title, $description, $images, $cta);

        if (\is_wp_error($heroPatterns)) {
            return new \WP_REST_Response([], 500);
        }

        $current = \WP_Theme_JSON_Resolver::get_merged_data('theme');

        $unfiltered = \WP_Theme_JSON_Resolver::get_style_variations();

        $colorAndFontsVariations = array_filter($unfiltered, function ($variation) {
            return self::variationHasProperties($variation, ['color', 'elements', 'typography']);
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
        array_walk($colorAndFontsVariations, function (&$variation) use ($slugMap) {
            if (!is_array($variation) || isset($variation['slug'])) {
                return;
            }

            $title = $variation['title'] ?? null;
            if ($title && isset($slugMap[$title])) {
                $variation['slug'] = $slugMap[$title];
            }
        });

        $processedFonts = array_map(function ($variation) {
            if (!isset($variation['styles']['elements']) || !is_array($variation['styles']['elements'])) {
                return $variation;
            }

            $variation['styles']['elements'] = array_map(
                [self::class, 'normalizeElementTypography'],
                $variation['styles']['elements']
            );

            if (!isset($variation['styles']['typography'])) {
                $variation['styles']['typography'] = [
                    'fontFamily' => 'var(--wp--preset--font-family--inter)'
                ];
            }

            return $variation;
        }, $colorAndFontsVariations);

        $deduped = static::getCss($processedFonts, $current, true);

        $blockEditorContext = new \WP_Block_Editor_Context(array( 'name' => 'core/edit-post' ));
        $editorSettings = get_block_editor_settings([], $blockEditorContext);
        $editorSettings['styles'] = [];

        return new \WP_REST_Response(
            [
                'patterns' => $heroPatterns,
                'colorAndFontsVariations' => $deduped,
                'blockEditorSettings' => $editorSettings ?? null,
            ]
        );
    }

    /**
     * Sets a lock on a post to prevent concurrent editing.
     *
     * @param \WP_REST_Request $request The REST API request object containing postId.
     * @return \WP_REST_Response Response indicating success of the lock operation.
     */
    public static function lockPost($request)
    {
        $postId = (int) $request->get_param('postId');
        require_once ABSPATH . '/wp-admin/includes/post.php';
        $data = \wp_set_post_lock($postId);
        return new \WP_REST_Response(['success' => $data !== false]);
    }

    /**
     * Persist the data
     *
     * @param \WP_REST_Request $request - The request.
     * @return \WP_REST_Response
     */
    public static function updateOption($request)
    {
        $params = $request->get_json_params();
        $key = $params['option'];
        $sanitized = Sanitizer::sanitizeUnknown($params['value']);

        if (strpos($key, 'extendify_') === 0) {
            $key = substr($key, 10);
        }
        \update_option('extendify_' . $key, $sanitized);

        return new \WP_REST_Response('OK');
    }

    /**
     * Get the data
     *
     * @param \WP_REST_Request $request - The request.
     * @return \WP_REST_Response
     */
    public static function getOption($request)
    {
        $key = $request->get_param('option');

        if (strpos($key, 'extendify_') === 0) {
            $key = substr($key, 10);
        }
        $value = \get_option('extendify_' . $key, null);

        return new \WP_REST_Response($value);
    }
}
