<?php
/**
 * Cache data.
 */

namespace Extendify\Assist\DataProvider;

defined('ABSPATH') || die('No direct access.');

use Extendify\Assist\Controllers\DomainsSuggestionController;
use Extendify\Assist\Controllers\RecommendationsController;
use Extendify\Config;
use Extendify\Http;
use Extendify\Shared\Services\Sanitizer;

/**
 * The cache data class.
 */
class ResourceData
{
    /**
     * HTTP instance to be used for querying the data.
     *
     * @var Http
     */
    protected $http;

    /**
     * The expiration interval.
     * (default 0, no expiration).
     *
     * @var float|int
     */
    protected $interval = 0;

    /**
     * Initiate the class.
     *
     * @return void
     */
    public function __construct()
    {
        $this->getHttpInstance();

        add_action('update_option', function ($option) {
            if ($option === 'WPLANG') {
                self::deleteCache();
            }
        });
    }


    /**
     * Register the cache schedule.
     *
     * @return void
     */
    public static function scheduleCache()
    {
        if (! wp_next_scheduled('extendify_cache_server_data')) {
            wp_schedule_event(
                current_time('timestamp'), // phpcs:ignore
                'daily',
                'extendify_cache_server_data'
            );
        }

        add_action('extendify_cache_server_data', [new ResourceData(), 'cache']);
    }


    /**
     * Regenerate and overwrite the cache.
     *
     * @return void
     */
    public function cache()
    {
        $endPoints = [
            'recommendations' => $this->getResponseData(RecommendationsController::fetchRecommendations()),
            'domainsSuggestion' => $this->getResponseData(DomainsSuggestionController::suggestDomains()),
        ];

        foreach ($endPoints as $key => $endpoint) {
            $this->cacheData($key, $endpoint);
        }
    }

    /**
     * Return the data.
     *
     * @return array
     */
    public function getData()
    {
        return [
            'recommendations' => $this->recommendations(),
            'domains' => $this->domainsSuggestion(),
        ];
    }

    /**
     * Return the recommendations.
     *
     * @return mixed|\WP_REST_Response
     */
    protected function recommendations()
    {
        $recommendations = get_transient('extendify_' . Config::$version . '_' . __FUNCTION__);

        if ($recommendations === false) {
            $recommendations = $this->getResponseData(RecommendationsController::fetchRecommendations());
            $this->cacheData(__FUNCTION__, $recommendations);
        }

        return $recommendations;
    }

    /**
     * Return the domains suggestions.
     *
     * @return mixed|\WP_REST_Response
     */
    protected function domainsSuggestion()
    {
        $domains = get_transient('extendify_' . Config::$version . '_' . __FUNCTION__);

        if ($domains === false) {
            $domains = $this->getResponseData(DomainsSuggestionController::suggestDomains());
            $this->cacheData(__FUNCTION__, $domains);
        }

        return $domains;
    }

    /**
     * This function will check for the validity of the data, if the request was a success then
     * we store the results in the database, if not, we just ignore it.
     *
     * @param string $functionName The function name that we use in the store.
     * @param array  $data         The extracted data returned from the HTTP request.
     * @return void
     */
    protected function cacheData($functionName, $data)
    {
        if (!empty($data)) {
            set_transient('extendify_' . Config::$version . '_' . $functionName, Sanitizer::sanitizeArray($data), $this->interval);
        }
    }

    /**
     * This function will return the data from WP_REST_Response object if there is no error,
     * or return an empty array.
     *
     * @param \WP_REST_Response $data The response we need to filter.
     * @return array|mixed
     */
    protected function getResponseData($data)
    {
        $responseData = $data->get_data();

        if (is_wp_error($responseData)) {
            return [];
        }

        if (!is_array($responseData)) {
            $responseData = json_decode($responseData, true);
        }

        if (is_array($responseData)
            && array_key_exists('success', $responseData)
            && array_key_exists('data', $responseData)
            && $responseData['success']
        ) {
            return $responseData['data'];
        }

        return is_array($responseData) ? $responseData : [];
    }

    /**
     * Create an HTTP instance that we can use locally.
     *
     * @return void
     */
    protected function getHttpInstance()
    {
        $request = new \WP_REST_Request();

        $request->set_headers([
            'x_wp_nonce' => \wp_create_nonce('wp_rest'),
            'x_extendify' => true,
            'referer' => get_home_url(),
        ]);

        /**
         * This constant should have one of the following values:
         *
         * 1. x_extendify_assist_dev_mode.
         * 2. x_extendify_assist_local_mode.
         * 3. x_extendify_assist.
         *
         * default value is (x_extendify_assist).
         */

        if (!defined('EXTENDIFY_ASSIST_SERVER')) {
            define('EXTENDIFY_ASSIST_SERVER', 'x_extendify_assist');
        }

        $request->set_header(EXTENDIFY_ASSIST_SERVER, 'true');

        Http::init($request);
    }

    /**
     * Mark a given task as completed.
     *
     * @param string $slug The task slug that we need to search for.
     * @return void
     */
    protected function markTaskCompleted($slug)
    {
        $data = get_option('extendify_assist_tasks', []);

        if (!array_key_exists('state', $data)) {
            return;
        }

        if (!in_array($slug, array_column($data['state']['completedTasks'], 'id'), true)) {
            $data['state']['completedTasks'][] = [
                'id' => $slug,
                'completedAt' => gmdate('Y-m-d\TH:i:s.v\Z'),
            ];
            update_option('extendify_assist_tasks', Sanitizer::sanitizeArray($data));
        }
    }

    /**
     * Delete Cached Transient
     *
     * @return void
     */
    public static function deleteCache()
    {
        $storedTransient = [
            'recommendations',
            'domainsSuggestion',
        ];

        foreach ($storedTransient as $value) {
            \delete_transient('extendify_' . Config::$version . '_' . $value);
        }
    }
}
