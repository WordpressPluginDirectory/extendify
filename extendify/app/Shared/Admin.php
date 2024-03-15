<?php
/**
 * Help Center Script loader.
 */

namespace Extendify\Shared;

use Extendify\Shared\Controllers\UserSelectionController;
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
    }

    /**
     * Adds scripts to the admin
     *
     * @return void
     */
    public function loadScripts()
    {
        \add_action('admin_enqueue_scripts', [$this, 'loadGlobalScripts']);
        \add_action('wp_enqueue_scripts', [$this, 'loadGlobalScripts']);
    }

    /**
     * Adds scripts to every page
     *
     * @return void
     */
    public function loadGlobalScripts()
    {
        if (!current_user_can(Config::$requiredCapability)) {
            return;
        }

        \wp_enqueue_media();

        $version = Config::$environment === 'PRODUCTION' ? Config::$version : uniqid();
        \wp_register_script(Config::$slug . '-shared-scripts', '', [], $version, true);
        \wp_enqueue_script(Config::$slug . '-shared-scripts');

        $partnerData = PartnerData::getPartnerData();
        $userConsent = get_user_meta(get_current_user_id(), 'extendify_ai_consent', true);

        \wp_add_inline_script(
            Config::$slug . '-shared-scripts',
            'window.extSharedData = ' . \wp_json_encode([
                'devbuild' => \esc_attr(Config::$environment === 'DEVELOPMENT'),
                'siteId' => \get_option('extendify_site_id', ''),
                'siteTitle' => \get_bloginfo('name'),
                'siteType' => \get_option('extendify_siteType', new \stdClass()),
                'adminUrl' => \esc_url_raw(\admin_url()),
                'partnerLogo' => \esc_attr(PartnerData::$logo),
                'partnerId' => \esc_attr(PartnerData::$id),
                'partnerName' => \esc_attr(PartnerData::$name),
                'wpLanguage' => \get_locale(),
                'wpVersion' => \get_bloginfo('version'),
                'isBlockTheme' => function_exists('wp_is_block_theme') ? wp_is_block_theme() : false,
                'userId' => \get_current_user_id(),
                'userData' => [
                    'userSelectionData' => UserSelectionController::get(),
                ],
                'showAIConsent' => ($partnerData['showAIConsent'] ?? false),
                'consentTermsUrl' => ($partnerData['consentTermsUrl'] ?? ''),
                'userGaveConsent' => $userConsent ? $userConsent : false,
                'activePlugins' => get_option('active_plugins', []),
                'frontPage' => get_option('page_on_front', 0),
            ]),
            'before'
        );

        $cssColorVars = PartnerData::cssVariableMapping();
        $cssString = implode('; ', array_map(function ($k, $v) {
            return "$k: $v";
        }, array_keys($cssColorVars), $cssColorVars));
        \wp_register_style(Config::$slug . '-shared-styles', '', [], $version, 'all');
        \wp_enqueue_style(Config::$slug . '-shared-styles');
        \wp_add_inline_style(Config::$slug . '-shared-styles', "body { $cssString; }");
    }
}
