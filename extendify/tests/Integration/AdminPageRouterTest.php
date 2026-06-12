<?php

namespace Extendify\Tests\Integration;

use Extendify\Config;
use Extendify\PartnerData;
use Extendify\AdminPageRouter;
use WP_UnitTestCase;

/**
 * redirectOnce() bounces a useAgentOnboarding partner from
 * ?page=extendify-launch to ?page=extendify-auto-launch on the first
 * fresh-site request. The bounce must carry the partner's deep-link params
 * (objective/title/structure/tone/…) — previously it passed only `page`,
 * silently dropping every other param on first login (issue #2246).
 */
class AdminPageRouterTest extends WP_UnitTestCase
{
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        // PartnerData opts out without a partner id, which gates the
        // useAgentOnboarding round-trip redirectOnce() reads.
        if (!defined('EXTENDIFY_PARTNER_ID')) {
            define('EXTENDIFY_PARTNER_ID', 'test-partner');
        }
    }

    public function setUp(): void
    {
        parent::setUp();
        Config::$showLaunch = true;
        delete_option('extendify_launch_loaded');
        delete_transient('extendify_partner_data_cache_check');
        update_option('extendify_partner_data_v2', ['useAgentOnboarding' => true]);
        new PartnerData();
        $_GET = [];
    }

    public function tearDown(): void
    {
        $_GET = [];
        parent::tearDown();
    }

    public function test_launch_to_auto_launch_redirect_preserves_deep_link_params()
    {
        $_GET = [
            'page' => 'extendify-launch',
            'objective' => 'sell-products',
            'title' => 'Acme Co',
            'structure' => 'multi-page',
            'tone' => 'professional',
        ];

        $captured = $this->captureRedirect(fn () => (new AdminPageRouter())->redirectOnce());

        $params = [];
        parse_str(wp_parse_url($captured, PHP_URL_QUERY), $params);

        $this->assertSame('extendify-auto-launch', $params['page']);
        $this->assertSame('sell-products', $params['objective'] ?? null);
        $this->assertSame('Acme Co', $params['title'] ?? null);
        $this->assertSame('multi-page', $params['structure'] ?? null);
        $this->assertSame('professional', $params['tone'] ?? null);
    }

    /**
     * handleLaunchRedirect() routes a useAgentOnboarding partner from
     * /wp-admin/?launch-redirect to ?page=extendify-auto-launch while
     * onboarding is still pending. Like redirectOnce(), that hop must carry the
     * partner's deep-link params — it previously redirected to a bare
     * admin.php?page=… and dropped every param the partner passed.
     */
    public function test_launch_redirect_entry_preserves_deep_link_params()
    {
        Config::$launchCompleted = false;
        $_GET = [
            'launch-redirect' => '1',
            'objective' => 'sell-products',
            'title' => 'Acme Co',
            'structure' => 'multi-page',
            'tone' => 'professional',
        ];

        $captured = $this->captureRedirect(fn () => (new AdminPageRouter())->handleLaunchRedirect());

        $params = [];
        parse_str(wp_parse_url($captured, PHP_URL_QUERY), $params);

        $this->assertSame('extendify-auto-launch', $params['page']);
        $this->assertSame('sell-products', $params['objective'] ?? null);
        $this->assertSame('Acme Co', $params['title'] ?? null);
        $this->assertSame('multi-page', $params['structure'] ?? null);
        $this->assertSame('professional', $params['tone'] ?? null);
    }

    /**
     * Runs $fn, trapping the wp_safe_redirect() that ends redirectOnce(), and
     * returns the destination. wp_safe_redirect() exits after the wp_redirect
     * filter, so we throw from the filter to short-circuit before the exit.
     */
    private function captureRedirect(callable $fn): string
    {
        $captured = null;
        $trap = function ($location) use (&$captured) {
            $captured = $location;
            throw new \Exception('redirect-trapped');
        };
        add_filter('wp_redirect', $trap, 1);
        try {
            $fn();
        } catch (\Exception $e) {
            if ($e->getMessage() !== 'redirect-trapped') {
                throw $e;
            }
        } finally {
            remove_filter('wp_redirect', $trap, 1);
        }

        $this->assertNotNull($captured, 'redirectOnce() did not redirect');

        return $captured;
    }
}
