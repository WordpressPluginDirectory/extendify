<?php

/**
 * Data Controller
 */

namespace Extendify\Shared\Controllers;

use Extendify\Http;
use Extendify\PartnerData;

defined('ABSPATH') || die('No direct access.');

/**
 * The controller for handling general data
 */

class DataController
{
    /**
     * Get Partner Plugins information.
     *
     * @return \WP_REST_Response
     */
    public static function getPartnerPlugins()
    {
        $response = Http::get('/partner-plugins?' . http_build_query(['partner' => PartnerData::$id]));

        if (is_wp_error($response)) {
            return new \WP_REST_Response([], 500);
        }

        return new \WP_REST_Response($response);
    }

    /**
     * Just here to check for 200 (vs server rate limting)
     *
     * @return \WP_REST_Response
     */
    public static function ping()
    {
        return new \WP_REST_Response(true, 200);
    }
}
