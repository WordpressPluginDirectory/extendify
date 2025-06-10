<?php

/**
 * Data Controller
 */

namespace Extendify\Launch\Controllers;

defined('ABSPATH') || die('No direct access.');

use Extendify\Shared\Services\HttpClient;

/**
 * The controller for handling general data
 */

class DataController
{
    /**
     * Get Goals information.
     *
     * @param \WP_REST_Request $request - The wp rest request.
     *
     * @return \WP_REST_Response
     */
    public static function getGoals($request)
    {

        $result = HttpClient::get(
            'https://dashboard.extendify.com/api/onboarding/goals',
            [
                'params' => [
                    'title' => $request->get_param('title'),
                    'site_type' => $request->get_param('site_type'),
                    'site_profile' => $request->get_param('site_profile'),
                    'site_objective' => $request->get_param('site_objective'),
                    'site_id' => $request->get_param('site_id'),
                ],
            ],
            $request
        );

        return new \WP_REST_Response($result['response'], $result['code']);
    }
}
