<?php
/**
 * Admin.
 */

namespace Extendify\Assist;

defined('ABSPATH') || die('No direct access.');

use Extendify\Assist\Controllers\GlobalsController;
use Extendify\Assist\Controllers\RouterController;
use Extendify\Assist\Controllers\TasksController;
use Extendify\Assist\DataProvider\ResourceData;
use Extendify\Config;
use Extendify\PartnerData;

/**
 * This class handles any file loading for the admin area.
 */
class Admin
{
    /**
     * Adds various actions to set up the page
     *
     * @return self|void
     */
    public function __construct()
    {
        \add_action('admin_enqueue_scripts', [$this, 'loadPageScripts']);
        ResourceData::scheduleCache();
    }

    /**
     * Adds scripts to the main admin page
     *
     * @return void
     */
    public function loadPageScripts()
    {
        $version = constant('EXTENDIFY_DEVMODE') ? uniqid() : Config::$version;
        $scriptAssetPath = EXTENDIFY_PATH . 'public/build/' . Config::$assetManifest['extendify-assist-page.php'];
        $fallback = [
            'dependencies' => [],
            'version' => $version,
        ];
        $scriptAsset = file_exists($scriptAssetPath) ? require $scriptAssetPath : $fallback;

        foreach ($scriptAsset['dependencies'] as $style) {
            \wp_enqueue_style($style);
        }

        \wp_enqueue_script(
            Config::$slug . '-assist-page-scripts',
            EXTENDIFY_BASE_URL . 'public/build/' . Config::$assetManifest['extendify-assist-page.js'],
            array_merge([Config::$slug . '-shared-scripts'], $scriptAsset['dependencies']),
            $scriptAsset['version'],
            true
        );

        \wp_add_inline_script(
            Config::$slug . '-assist-page-scripts',
            'window.extAssistData = ' . \wp_json_encode([
                'launchCompleted' => (bool) Config::$launchCompleted,
                'hasCustomizer' => (bool) \has_action('customize_register'),
                'disableRecommendations' => (bool) PartnerData::setting('disableRecommendations'),
                'domainsSuggestionSettings' => [
                    'showBanner' => (bool) PartnerData::setting('showDomainBanner'),
                    'showTask' => (bool) PartnerData::setting('showDomainTask'),
                    'showSecondaryBanner' => (bool) PartnerData::setting('showSecondaryDomainBanner'),
                    'showSecondaryTask' => (bool) PartnerData::setting('showSecondaryDomainTask'),
                    'stagingSites' => array_map('esc_attr', PartnerData::setting('stagingSites')),
                    'searchUrl' => \esc_attr(PartnerData::setting('domainSearchURL')),
                ],
                'userData' => [
                    'taskData' => \wp_json_encode(TasksController::get()->get_data()),
                    'globalData' => \wp_json_encode(GlobalsController::get()->get_data()),
                    'routerData' => \wp_json_encode(RouterController::get()->get_data()),
                    'recommendationData' => \wp_json_encode(RouterController::get()->get_data()),
                    'tasksDependencies' => \wp_json_encode($this->getTasksDependecies()),
                ],
                'resourceData' => \wp_json_encode((new ResourceData())->getData()),
                'canSeeRestartLaunch' => (bool) $this->canRunLaunchAgain(),
                'editSiteNavigationMenuLink' => \current_theme_supports('menus') ? \esc_url(\admin_url('nav-menus.php')) : \esc_url(\admin_url('site-editor.php?path=%2Fnavigation')),
            ]),
            'before'
        );

        \wp_set_script_translations(Config::$slug . '-assist-page-scripts', 'extendify-local', EXTENDIFY_PATH . 'languages/js');

        \wp_enqueue_style(
            Config::$slug . '-assist-page-styles',
            EXTENDIFY_BASE_URL . 'public/build/' . Config::$assetManifest['extendify-assist-page.css'],
            [],
            Config::$version,
            'all'
        );
    }


    /**
     * Check to see if the user can re-run Launch
     *
     * @return boolean
     */
    public function canRunLaunchAgain()
    {
        if (\get_option('stylesheet') !== 'extendable') {
            return false;
        }

        $launchCompleted = \get_option('extendify_onboarding_completed', false);
        if (!$launchCompleted) {
            return false;
        }

        try {
            $datetime1 = new \DateTime($launchCompleted);
            $interval = $datetime1->diff(new \DateTime());
            return $interval->format('%d') <= 2;
        } catch (\Exception $exception) {
            return false;
        }
    }

    /**
     * Check to see if specific tasks are completed or not.
     *
     * @return array
     */
    public function getTasksDependecies()
    {
        $give = \get_option('give_onboarding', false);
        $completedSetupGivewp = isset($give['form_id']) && $give['form_id'] > 0;

        $woo = \get_option('woocommerce_onboarding_profile', false);
        $completedwWoocommerceStore = (isset($woo['completed']) && $woo['completed']) || (isset($woo['skipped']) && $woo['skipped']);

        return [
            'completedSetupGivewp' => $completedSetupGivewp,
            'completedWoocommerceStore' => $completedwWoocommerceStore,
        ];
    }
}
