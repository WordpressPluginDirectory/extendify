<?php
/**
 * Help Center Script loader.
 */

namespace Extendify\HelpCenter;

use Extendify\Config;
use Extendify\PartnerData;
use Extendify\HelpCenter\DataProvider\ResourceData;
use Extendify\HelpCenter\Controllers\TourController;
use Extendify\HelpCenter\Controllers\RouterController;
use Extendify\HelpCenter\Controllers\SupportArticlesController;

/**
 * This class handles any file loading for the admin area.
 */
class Admin
{
    /**
     * The instance
     *
     * @var $instance
     */
    public static $instance = null;

    /**
     * Adds various actions to set up the page
     *
     * @return self|void
     */
    public function __construct()
    {
        if (self::$instance) {
            return self::$instance;
        }

        self::$instance = $this;

        if (PartnerData::$id === 'no-partner' && Config::$environment === 'PRODUCTION') {
            return;
        }

        \add_action('admin_enqueue_scripts', [$this, 'loadGlobalScripts']);
    }

    /**
     * Adds scripts to every page.
     *
     * @return void
     */
    public function loadGlobalScripts()
    {
        if (!current_user_can(Config::$requiredCapability)) {
            return;
        }

        // Don't load on Launch.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if (isset($_GET['page']) && $_GET['page'] === 'extendify-launch') {
            return;
        }

        $version = Config::$environment === 'PRODUCTION' ? Config::$version : uniqid();

        $scriptAssetPath = EXTENDIFY_PATH . 'public/build/' . Config::$assetManifest['extendify-help-center.php'];
        $fallback = [
            'dependencies' => [],
            'version' => $version,
        ];
        $scriptAsset = file_exists($scriptAssetPath) ? require $scriptAssetPath : $fallback;

        foreach ($scriptAsset['dependencies'] as $style) {
            \wp_enqueue_style($style);
        }

        \wp_enqueue_script(
            Config::$slug . '-help-center-scripts',
            EXTENDIFY_BASE_URL . 'public/build/' . Config::$assetManifest['extendify-help-center.js'],
            $scriptAsset['dependencies'],
            $scriptAsset['version'],
            true
        );

        $partnerData = PartnerData::getPartnerData();

        \wp_add_inline_script(
            Config::$slug . '-help-center-scripts',
            'window.extHelpCenterData = ' . \wp_json_encode([
                'showChat' => ($partnerData['showChat'] ?? false),
                'supportUrl' => ($partnerData['supportUrl'] ?? ''),
                'userData' => [
                    'tourData' => TourController::get(),
                    'supportArticlesData' => SupportArticlesController::get(),
                    'routerData' => RouterController::get(),
                ],
                'resourceData' => (new ResourceData())->getData(),
            ]),
            'before'
        );

        \wp_set_script_translations(
            Config::$slug . '-help-center-scripts',
            'extendify-local',
            EXTENDIFY_PATH . 'languages/js'
        );

        \wp_enqueue_style(
            Config::$slug . '-help-center-styles',
            EXTENDIFY_BASE_URL . 'public/build/' . Config::$assetManifest['extendify-help-center.css'],
            [],
            Config::$version,
            'all'
        );

    }
}
