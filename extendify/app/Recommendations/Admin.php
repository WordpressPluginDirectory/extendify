<?php

/**
 * Admin.
 */

namespace Extendify\Recommendations;

defined('ABSPATH') || die('No direct access.');

use Extendify\Config;
use Extendify\PartnerData;
use Extendify\Shared\Services\Sanitizer;
use Extendify\Shared\Services\Escaper;

/**
 * This class handles any file loading for the admin area.
 */

class Admin
{
    /**
     * Recommendations api endpoint
     *
     * @var string
     */
    public $baseUrl = 'https://dashboard.extendify.com/api/recommendations';

    /**
     * Adds various actions to set up the page
     *
     * @return void
     */
    public function __construct()
    {
        \add_action('admin_enqueue_scripts', [$this, 'loadScriptsAndStyles']);
    }

    /**
     * Gets the recommended products based on partner and current language.
     *
     * @return array
     */
    public function getProductsData()
    {
        // Check cache before fetching.
        $products = get_transient('extendify_recommendations_products');

        // Return products from cache if not empty.
        if ($products !== false) {
            return $products;
        }

        // Otherwise fetch products.
        $response = \wp_remote_get(
            \add_query_arg(
                [
                    'disabled_products' => PartnerData::setting('productRecommendations')['disabledProducts'],
                    'custom_products' => PartnerData::setting('productRecommendations')['customProducts'],
                    'wp_language' => \get_locale(),
                ],
                $this->baseUrl . '/products'
            ),
            [
                'headers' => ['Accept' => 'application/json'],
            ]
        );

        if (\is_wp_error($response)) {
            return [];
        }

        $result = json_decode(\wp_remote_retrieve_body($response), true);

        if (!isset($result['success']) || !$result['success']) {
            return [];
        }

        $products = $result['data'];
        $sanitizedProducts = [];

        foreach ($products as $product) {
            // We are escaping the original price tag separately because we are using HTML tags
            // inside it and they are removed when going through the `sanitizeArray` function.
            $originalPriceTag = $product['priceTag'];
            $sanitizedPriceTag = Sanitizer::sanitizeTextWithFormattingTags($originalPriceTag);
            $sanitizedProduct = Sanitizer::sanitizeArray($product);
            $sanitizedProduct['priceTag'] = $sanitizedPriceTag;
            $sanitizedProducts[] = $sanitizedProduct;
        }

        // Cache products.
        set_transient('extendify_recommendations_products', $sanitizedProducts, DAY_IN_SECONDS);

        return $sanitizedProducts;
    }

    /**
     * Adds various JS scripts if on the plugin install page
     *
     * @return void
     */
    public function loadScriptsAndStyles()
    {
        if (\get_current_screen()->id !== 'plugin-install') {
            return;
        }

        $version = constant('EXTENDIFY_DEVMODE') ? uniqid() : Config::$version;
        $scriptAssetPath = EXTENDIFY_PATH . 'public/build/' . Config::$assetManifest['extendify-recommendations.php'];
        $fallback = [
            'dependencies' => [],
            'version' => $version,
        ];
        $scriptAsset = file_exists($scriptAssetPath) ? require $scriptAssetPath : $fallback;

        foreach ($scriptAsset['dependencies'] as $style) {
            \wp_enqueue_style($style);
        }

        \wp_enqueue_script(
            Config::$slug . '-recommendations-scripts',
            EXTENDIFY_BASE_URL . 'public/build/' . Config::$assetManifest['extendify-recommendations.js'],
            array_merge([Config::$slug . '-shared-scripts'], $scriptAsset['dependencies']),
            $scriptAsset['version'],
            true
        );

        \wp_enqueue_style(
            Config::$slug . '-recommendations-styles',
            EXTENDIFY_BASE_URL . 'public/build/' . Config::$assetManifest['extendify-recommendations.css'],
            [],
            Config::$version,
            'all'
        );

        \wp_add_inline_script(
            Config::$slug . '-recommendations-scripts',
            'window.extRecommendationsData = ' . \wp_json_encode(
                [
                    'products' => Escaper::recursiveEscAttr($this->getProductsData()),
                    'showPartnerBranding' => (bool) \esc_attr(
                        PartnerData::setting('productRecommendations')['showPartnerBranding']
                    ),
                ]
            ),
            'before'
        );
        \wp_set_script_translations(
            Config::$slug . '-recommendations-scripts',
            'extendify-local',
            EXTENDIFY_PATH . 'languages/js'
        );
    }
}
