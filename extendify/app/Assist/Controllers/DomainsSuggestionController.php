<?php
/**
 * Controls Suggest Domains
 */

namespace Extendify\Assist\Controllers;

defined('ABSPATH') || die('No direct access.');

use Extendify\Config;
use Extendify\PartnerData;

/**
 * The controller for fetching quick links
 */
class DomainsSuggestionController
{
    /**
     * The url for the new API server.
     *
     * @var string
     */
    public static $host = 'https://ai.extendify.com';

    /**
     * The list of strings to block from using the api.
     *
     * @var array
     */
    public static $blockList = ['instawp.xyz', 'my blog'];

    /**
     * Return domains recommendation.
     *
     * @return \WP_REST_Response
     */
    public static function suggestDomains()
    {
        if (!\esc_attr(PartnerData::setting('showDomainBanner')) && !\esc_attr(PartnerData::setting('showDomainTask'))) {
            return new \WP_REST_Response([]);
        }

        if (!self::hasValidSiteTitle(\get_bloginfo('name'))) {
            return new \WP_REST_Response([]);
        }

        $data = [
            'query' => self::cleanSiteTitle(\get_bloginfo('name')),
            'devbuild' => (bool) constant('EXTENDIFY_DEVMODE'),
            'siteId' => \get_option('extendify_site_id', ''),
            'tlds' => \esc_attr(PartnerData::setting('domainTLDs')),
            'partnerId' => \esc_attr(PartnerData::$id),
            'wpLanguage' => \get_locale(),
            'wpVersion' => \get_bloginfo('version'),
        ];

        $response = wp_remote_get(sprintf(
            '%s/api/domains/suggest?%s',
            static::$host,
            http_build_query($data)
        ));

        if (is_wp_error($response)) {
            return new \WP_REST_Response([]);
        }

        return new \WP_REST_Response(wp_remote_retrieve_body($response));
    }

    /**
     * Clean site title.
     *
     * @param string $siteTitle - The site title to clean.
     * @return string
     */
    public static function cleanSiteTitle($siteTitle)
    {
        $siteTitle = html_entity_decode($siteTitle);
        return preg_replace('/[^\p{L}\p{N}\-]+/u', '', $siteTitle);
    }

    /**
     * Check if the site Title is part of the blocked list.
     *
     * @param string $siteTitle - The site title to check.
     * @return bool
     */
    public static function hasValidSiteTitle($siteTitle)
    {
        return empty(array_filter(self::$blockList, function ($item) use ($siteTitle) {
            // in php 8.0 we can use str_contains.
            return strpos(strtolower($siteTitle), strtolower($item)) !== false;
        }));
    }

    /**
     * Delete the cache for the domains suggestions.
     *
     * @return \WP_REST_Response
     */
    public static function deleteCache()
    {
        \delete_transient('extendify_' . Config::$version . '_domainsSuggestion');

        return new \WP_REST_Response(['success' => true]);
    }
}
