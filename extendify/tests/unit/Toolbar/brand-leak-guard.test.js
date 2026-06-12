// Brand-leak guard for the Toolbar + Quick Edit JS.
//
// On white-label partner sites the "Extendify" brand must never reach a
// user-facing surface. Scans every WP i18n call (__/_x/_n/_nx) under
// src/QuickEdit + src/Toolbar and fails if any translatable string
// contains "Extendify".
//
// PHP side: tests/Integration/Toolbar/BrandLeakGuardTest.php.
// Translated side: .github/translations/scan-redflags.py (no "Extendify"
// in any locale's msgstr).

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const SRC_DIRS = ['src/QuickEdit', 'src/Toolbar'];

const jsFiles = (dir) =>
	readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) return jsFiles(full);
		return /\.jsx?$/.test(name) ? [full] : [];
	});

describe('Brand-leak guard — Quick Edit + Toolbar JS', () => {
	it('no user-facing (translatable) string contains "Extendify"', () => {
		const root = resolve(__dirname, '../../..');
		const offenders = [];
		for (const dir of SRC_DIRS) {
			for (const file of jsFiles(join(root, dir))) {
				const src = readFileSync(file, 'utf8');
				const calls = src.matchAll(
					/\b(?:__|_x|_n|_nx)\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1/g,
				);
				for (const m of calls) {
					if (/extendify/i.test(m[2])) {
						offenders.push(`${file.slice(root.length + 1)}: "${m[2]}"`);
					}
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
