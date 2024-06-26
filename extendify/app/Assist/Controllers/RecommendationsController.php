<?php
/**
 * Controls Recommendations
 */

namespace Extendify\Assist\Controllers;

defined('ABSPATH') || die('No direct access.');

use Extendify\Http;
use Extendify\Shared\Services\Sanitizer;

/**
 * The controller for fetching recommendations
 */
class RecommendationsController
{
    /**
     * Return recommendations from source.
     *
     * @return \WP_REST_Response
     */
    public static function fetchRecommendations()
    {
        $response = Http::get('/recommendations');
        return new \WP_REST_Response(
            $response,
            wp_remote_retrieve_response_code($response)
        );
    }

    /**
     * Return the data
     *
     * @return \WP_REST_Response
     */
    public static function get()
    {
        $data = get_option('extendify_help_center_recommendations', []);
        return new \WP_REST_Response($data);
    }

    /**
     * Persist the data
     *
     * @param \WP_REST_Request $request - The request.
     * @return \WP_REST_Response
     */
    public static function store($request)
    {
        $data = json_decode($request->get_param('state'), true);
        update_option('extendify_help_center_recommendations', Sanitizer::sanitizeArray($data));
        return new \WP_REST_Response($data);
    }
}
