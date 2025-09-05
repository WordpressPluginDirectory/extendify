<?php

/**
 * Filters for affiliate links.
 */

namespace Extendify;

defined('ABSPATH') || die('No direct access.');

/**
 * The affiliate class.
 */

class Affiliate
{
    /**
     * Affiliate data
     *
     * @var array $data
     */
    protected $data = [];

    /**
     * Initiate the class.
     */
    public function __construct()
    {
        $this->data = PartnerData::getPartnerData();

        $this->wpforms();
        $this->aioseo();
    }

    /**
     * Add the affiliate links to WPForms.
     *
     * @return void
     */
    private function wpforms()
    {
        if (! $this->isEnabled('wpforms-lite')) {
            return;
        }

        add_filter('wpforms_upgrade_link', function ($url) {
            return add_query_arg('campaign', Config::$partnerId, add_query_arg('ref', '51', $url));
        }, PHP_INT_MAX);
    }

    /**
     * Add the affiliate links to AIOSEO.
     *
     * @return void
     */
    private function aioseo()
    {
        if (! $this->isEnabled('all-in-one-seo-pack')) {
            return;
        }

        add_filter('aioseo_upgrade_link', function ($url) {
            return add_query_arg('campaign', Config::$partnerId, add_query_arg('ref', '67', $url));
        }, PHP_INT_MAX);
    }

    /**
     * Check to see if the affiliation is enabled for the plugin.
     *
     * @param string $pluginSlug The plugin slug.
     * @return boolean
     */
    private function isEnabled($pluginSlug)
    {
        return !array_key_exists('blockAffiliate_' . $pluginSlug, $this->data);
    }
}
