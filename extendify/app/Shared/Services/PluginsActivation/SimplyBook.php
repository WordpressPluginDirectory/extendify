<?php

namespace Extendify\Shared\Services\PluginsActivation;

defined('ABSPATH') || die('No direct access.');

class SimplyBook extends PluginActivation
{
    public static function slug(): string
    {
        return 'simplybook';
    }

    protected static function requestHeaders(): array
    {
        return ['Content-Type' => 'application/json', 'X-WP-Nonce' => \wp_create_nonce('wp_rest')];
    }

    protected static function simplybookNonce(): string
    {
        return \wp_create_nonce('simplybook_nonce');
    }

    protected static function sslVerify(): bool
    {
        return !(defined('EXTENDIFY_DEVMODE') && \constant('EXTENDIFY_DEVMODE'));
    }

    protected static function authCookies(): array
    {
        $cookies = [];
        foreach ([\AUTH_COOKIE, \SECURE_AUTH_COOKIE, \LOGGED_IN_COOKIE] as $cookieName) {
            if (isset($_COOKIE[$cookieName])) {
                // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
                $cookieValue = \wp_unslash($_COOKIE[$cookieName]);
                $cookies[] = new \WP_Http_Cookie(['name' => $cookieName, 'value' => $cookieValue]);
            }
        }
        return $cookies;
    }

    public static function createAccount(\WP_REST_Request $request): \WP_REST_Response
    {
        if (!static::isActive()) {
            return static::pluginNotActiveResponse();
        }

        $nonce = static::simplybookNonce();
        $headers = static::requestHeaders();
        $sslVerify = static::sslVerify();

        // Reset onboarding data to have a fresh start
        delete_option('simplybook_onboarding_completed');
        $retryResponse = \wp_remote_post(\rest_url('simplybook/v1/onboarding/retry_onboarding'), [
            'headers' => $headers,
            'cookies' => static::authCookies(),
            'sslverify' => $sslVerify,
            'body' => \wp_json_encode(['nonce' => $nonce]),
        ]);

        if (\is_wp_error($retryResponse)) {
            return new \WP_REST_Response(['message' => $retryResponse->get_error_message()], 500);
        }

        $createResponse = \wp_remote_post(\rest_url('simplybook/v1/onboarding/create_account'), [
            'headers' => $headers,
            'cookies' => static::authCookies(),
            'sslverify' => $sslVerify,
            'timeout' => 10,
            'body' => \wp_json_encode([
                'email' => \sanitize_email($request->get_param('email')),
                'terms-and-conditions' => (bool) $request->get_param('termsAgreed'),
                'marketing-consent' => (bool) $request->get_param('marketingConsent'),
                'captcha_token' => \sanitize_text_field($request->get_param('captcha_token')),
                'nonce' => $nonce,
            ]),
        ]);

        if (\is_wp_error($createResponse)) {
            return new \WP_REST_Response(['message' => $createResponse->get_error_message()], 500);
        }

        $createStatus = \wp_remote_retrieve_response_code($createResponse);
        if ($createStatus >= 400) {
            $data = json_decode(\wp_remote_retrieve_body($createResponse), true) ?? [];
            return new \WP_REST_Response($data, $createStatus);
        }

        $finishResponse = \wp_remote_post(\rest_url('simplybook/v1/onboarding/finish_onboarding'), [
            'headers' => $headers,
            'cookies' => static::authCookies(),
            'sslverify' => $sslVerify,
            'body' => \wp_json_encode(['nonce' => $nonce]),
        ]);

        if (\is_wp_error($finishResponse)) {
            return new \WP_REST_Response(['message' => $finishResponse->get_error_message()], 500);
        }

        $finishStatus = \wp_remote_retrieve_response_code($finishResponse);
        if ($finishStatus >= 400) {
            $data = json_decode(\wp_remote_retrieve_body($finishResponse), true) ?? [];
            return new \WP_REST_Response($data, $finishStatus);
        }

        return new \WP_REST_Response(['success' => true], 200);
    }
}
