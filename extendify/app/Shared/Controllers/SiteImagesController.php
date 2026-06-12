<?php

/**
 * Controls cached site images
 */

namespace Extendify\Shared\Controllers;

defined('ABSPATH') || die('No direct access.');

use Extendify\Constants;
use Extendify\Shared\Services\HttpClient;
use Extendify\Shared\Services\Sanitizer;

/**
 * The controller for the persisted site images cache
 */

class SiteImagesController
{
    /**
     * Return cached site images, lazy-fetching from the images service when missing.
     *
     * @return \WP_REST_Response
     */
    public static function get()
    {
        $siteImages = \get_option('extendify_site_images', []);

        if (!empty($siteImages)) {
            return new \WP_REST_Response(['siteImages' => $siteImages]);
        }

        return new \WP_REST_Response(['siteImages' => self::refresh()]);
    }

    /**
     * Persist a provided site images array.
     *
     * @param \WP_REST_Request $request - The request.
     * @return \WP_REST_Response
     */
    public static function store($request)
    {
        $siteImages = $request->get_param('siteImages');
        if (!is_array($siteImages)) {
            $siteImages = [];
        }

        \update_option('extendify_site_images', Sanitizer::sanitizeArray($siteImages));
        return new \WP_REST_Response(['siteImages' => $siteImages]);
    }

    /**
     * Delete the cached site images option.
     *
     * @return \WP_REST_Response
     */
    public static function clear()
    {
        \delete_option('extendify_site_images');
        return new \WP_REST_Response(['siteImages' => []]);
    }

    /**
     * Fetch fresh images from the images service using the stored site profile,
     * persist them, and return the array. Returns [] when the profile is empty
     * or the upstream call fails.
     *
     * @return array
     */
    private static function refresh()
    {
        $siteProfile = \get_option('extendify_site_profile', []);
        if (empty($siteProfile)) {
            return [];
        }

        $response = HttpClient::post(
            Constants::IMAGES_HOST . '/api/search',
            [
                'params' => [
                    'siteProfile' => $siteProfile,
                    'source' => 'shared',
                ],
            ],
            null,
            true
        );

        $siteImages = $response['response']['siteImages'] ?? [];
        if (!is_array($siteImages) || empty($siteImages)) {
            return [];
        }

        \update_option('extendify_site_images', Sanitizer::sanitizeArray($siteImages));
        return $siteImages;
    }
}
