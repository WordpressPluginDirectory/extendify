<?php

namespace Extendify\Tests\Integration\Toolbar;

use WP_UnitTestCase;

/**
 * Brand-leak guard for the Toolbar + Quick Edit features.
 *
 * On white-label partner sites the "Extendify" brand must never reach
 * a user-facing surface. This statically scans every WP i18n call in
 * app/Toolbar + app/QuickEdit and fails if any translatable string
 * contains "Extendify" — catching reintroduction anywhere in those
 * features, not just the one aria-label we neutralized.
 *
 * Pairs with .github/translations/scan-redflags.py, which guards the
 * translated side (no "Extendify" in any locale's msgstr).
 */
class BrandLeakGuardTest extends WP_UnitTestCase
{
    public function testNoExtendifyInToolbarOrQuickEditStrings(): void
    {
        $root = dirname(__DIR__, 3);
        $offenders = [];
        foreach (['app/Toolbar', 'app/QuickEdit'] as $dir) {
            foreach ($this->i18nStrings($root, $dir) as [$where, $text]) {
                if (stripos($text, 'extendify') !== false) {
                    $offenders[] = sprintf('%s  "%s"', $where, $text);
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "User-facing string(s) leak the Extendify brand:\n" . implode("\n", $offenders)
        );
    }

    /**
     * Yield ["relPath:line", firstStringArg] for every WP i18n call in
     * the .php files under $root/$dir.
     *
     * @return \Generator<array{0:string,1:string}>
     */
    private function i18nStrings(string $root, string $dir): \Generator
    {
        $abs = $root . '/' . $dir;
        if (!is_dir($abs)) {
            return;
        }
        // Quote-aware: i18n fn, opening quote, escape-aware body, matching close.
        $re = <<<'REGEX'
/\b(?:esc_html_x|esc_attr_x|esc_html__|esc_attr__|esc_html_e|esc_attr_e|_nx|_x|_n|__|_e)\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1/
REGEX;
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($abs, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($it as $file) {
            if (strtolower($file->getExtension()) !== 'php') {
                continue;
            }
            $rel = $dir . substr($file->getPathname(), strlen($abs));
            foreach (file($file->getPathname(), FILE_IGNORE_NEW_LINES) as $n => $text) {
                if (preg_match_all($re, $text, $matches, PREG_SET_ORDER)) {
                    foreach ($matches as $hit) {
                        yield [$rel . ':' . ($n + 1), $hit[2]];
                    }
                }
            }
        }
    }
}
