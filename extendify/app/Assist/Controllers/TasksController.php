<?php
/**
 * Controls Tasks
 */

namespace Extendify\Assist\Controllers;

use Extendify\Http;
use Extendify\Assist\Controllers\WPController;

if (!defined('ABSPATH')) {
    die('No direct access.');
}

/**
 * The controller for plugin dependency checking, etc
 */
class TasksController
{
    /**
     * Return tasks from either database or source.
     *
     * @return \WP_REST_Response
     */
    public static function fetchTasks()
    {
        $plugins = WPController::getActivePlugins()->get_data();
        $response = Http::get('/tasks');

        if (is_array($response) && array_key_exists('data', $response)) {
            $data = array_filter($response['data'], function ($item) use ($plugins) {
                if (empty($item['plugins'])) {
                    return true;
                }

                return array_intersect($item['plugins'], $plugins['data']);
            });

            $response['data'] = array_values($data);
        }

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
        $data = get_option('extendify_assist_tasks', []);
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
        update_option('extendify_assist_tasks', $data);
        return new \WP_REST_Response($data);
    }

    /**
     * Returns remaining incomplete tasks.
     *
     * @return int
     */
    public function getRemainingCount()
    {
        $tasks = get_option('extendify_assist_tasks', []);
        if (!isset($tasks['state']['seenTasks'])) {
            return 0;
        }

        $seenTasks = count($tasks['state']['seenTasks']);
        $completedTasks = count($tasks['state']['completedTasks']);
        return max(($seenTasks - $completedTasks), 0);
    }

    /**
     * Returns whether the task dependency was completed.
     *
     * @param \WP_REST_Request $request - The request.
     * @return Boolean
     */
    public static function dependencyCompleted($request)
    {
        $task = $request->get_param('taskName');
        // If no depedency then consider it not yet completed.
        // The user will complete them manually by other means.
        $completed = false;

        if ($task === 'setup-givewp') {
            $give = \get_option('give_onboarding', false);
            $completed = isset($give['form_id']) && $give['form_id'] > 0;
        }

        if ($task === 'setup-woocommerce-store') {
            $woo = \get_option('woocommerce_onboarding_profile', false);
            $completed = (isset($woo['completed']) && $woo['completed']) || (isset($woo['skipped']) && $woo['skipped']);
        }

        return new \WP_REST_Response(['data' => $completed]);
    }
}
