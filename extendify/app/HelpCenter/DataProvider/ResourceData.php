<?php
/**
 * Cache data.
 */

namespace Extendify\HelpCenter\DataProvider;

defined('ABSPATH') || die('No direct access.');

use Extendify\Config;
use Extendify\HelpCenter\Controllers\SupportArticlesController;
use Extendify\HelpCenter\Controllers\TourController;
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
     * The cache group.
     *
     * @var string
     */
    protected $group = 'extendify_';

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
            'tours' => $this->getResponseData(TourController::fetchTours()),
            'supportArticles' => $this->getResponseData(SupportArticlesController::articles()),
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
            'tours' => $this->tours(),
            'supportArticles' => $this->supportArticles(),
        ];
    }

    /**
     * Return the support articles.
     *
     * @return mixed|\WP_REST_Response
     */
    protected function supportArticles()
    {
        $supportArticles = get_transient($this->group . Config::$version . '_' . __FUNCTION__);

        if ($supportArticles === false) {
            $supportArticles = $this->getResponseData(SupportArticlesController::articles());
            $this->cacheData(__FUNCTION__, $supportArticles);
        }

        return $supportArticles;
    }

    /**
     * Return the tours.
     *
     * @return mixed|\WP_REST_Response
     */
    protected function tours()
    {
        $tours = get_transient($this->group . Config::$version . '_' . __FUNCTION__);

        if ($tours === false) {
            $tours = $this->getResponseData(TourController::fetchTours());
            $this->cacheData(__FUNCTION__, $tours);
        }

        return $tours;
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
            set_transient($this->group . Config::$version . '_' . $functionName, Sanitizer::sanitizeArray($data), $this->interval);
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

        // TODO Lets try to remove this dependency and the "dev server" concept.
        if (!defined('EXTENDIFY_ASSIST_SERVER')) {
            define('EXTENDIFY_ASSIST_SERVER', 'x_extendify_assist');
        }

        $request->set_header(EXTENDIFY_ASSIST_SERVER, 'true');

        Http::init($request);
    }

    /**
     * Delete Cached Transient
     *
     * @return void
     */
    public static function deleteCache()
    {
        $storedTransient = [
            'tours',
            'supportArticles',
        ];

        foreach ($storedTransient as $value) {
            \delete_transient('extendify_' . Config::$version . '_' . $value);
        }
    }
}
