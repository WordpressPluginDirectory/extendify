<?php
/**
 * Admin.
 */

namespace Extendify\Assist;

use Extendify\Assist\DataProvider\ResourceData;
use Extendify\Assist\Controllers\GlobalsController;
use Extendify\Assist\Controllers\RouterController;
use Extendify\Assist\Controllers\TasksController;
use Extendify\PartnerData;
use Extendify\Config;

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

        $this->loadScripts();

        add_action('after_setup_theme', function () {
            // phpcs:ignore WordPress.Security.NonceVerification
            if (isset($_GET['extendify-disable-admin-bar'])) {
                show_admin_bar(false);
            }
        });

        ResourceData::scheduleCache();
    }

    /**
     * Adds scripts to the admin
     *
     * @return void
     */
    public function loadScripts()
    {
        \add_action('admin_enqueue_scripts', [$this, 'loadPageScripts']);
    }

    /**
     * Adds scripts to the main admin page
     *
     * @return void
     */
    public function loadPageScripts()
    {
        if (!current_user_can(Config::$requiredCapability)) {
            return;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if (!isset($_GET['page']) || $_GET['page'] !== 'extendify-assist') {
            return;
        }

        $siteInstalled = \get_users([
            'orderby' => 'registered',
            'order' => 'ASC',
            'number' => 1,
            'fields' => ['user_registered'],
        ])[0]->user_registered;

        $version = Config::$environment === 'PRODUCTION' ? Config::$version : uniqid();
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
            $scriptAsset['dependencies'],
            $scriptAsset['version'],
            true
        );

        $assistState = \get_option('extendify_assist_globals');
        $dismissed = isset($assistState['state']['dismissedNotices']) ? $assistState['state']['dismissedNotices'] : [];
        \wp_add_inline_script(
            Config::$slug . '-assist-page-scripts',
            'window.extAssistData = ' . \wp_json_encode([
                'devbuild' => \esc_attr(Config::$environment === 'DEVELOPMENT'),
                'siteId' => \get_option('extendify_site_id', ''),
                // Only send insights if they have opted in explicitly.
                'insightsEnabled' => defined('EXTENDIFY_INSIGHTS_URL'),
                'root' => \esc_url_raw(\rest_url(Config::$slug . '/' . Config::$apiVersion)),
                'nonce' => \wp_create_nonce('wp_rest'),
                'adminUrl' => \esc_url_raw(\admin_url()),
                'home' => \esc_url_raw(\get_home_url()),
                'siteCreatedAt' => $siteInstalled ? $siteInstalled : null,
                'asset_path' => \esc_url(EXTENDIFY_URL . 'public/assets'),
                'launchCompleted' => Config::$launchCompleted,
                'dismissedNotices' => $dismissed,
                'partnerLogo' => \esc_attr(PartnerData::$logo),
                'partnerName' => \esc_attr(PartnerData::$name),
                'partnerId' => \esc_attr(PartnerData::$id),
                'blockTheme' => \wp_is_block_theme(),
                'hasCustomizer' => \has_action('customize_register'),
                'themeSlug' => \get_option('stylesheet'),
                'wpLanguage' => \get_locale(),
                'disableRecommendations' => (bool) \esc_attr(PartnerData::$disableRecommendations),
                'domainsSuggestionSettings' => [
                    'showBanner' => (bool) \esc_attr(PartnerData::$showDomainBanner),
                    'showTask' => (bool) \esc_attr(PartnerData::$showDomainTask),
                    'tlds' => \esc_attr(PartnerData::$domainTLDs),
                    'searchUrl' => \esc_attr(PartnerData::$domainSearchURL),
                ],
                'userData' => [
                    'taskData' => TasksController::get(),
                    'globalData' => GlobalsController::get(),
                    'routerData' => RouterController::get(),
                    'recommendationData' => RouterController::get(),
                    'tasksDependencies' => $this->getTasksDependecies(),
                ],
                'resourceData' => (new ResourceData())->getData(),
                'canSeeRestartLaunch' => $this->canRunLaunchAgain(),
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
