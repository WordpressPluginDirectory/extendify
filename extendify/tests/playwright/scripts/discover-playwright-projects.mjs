#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const TEST_DIR = 'tests/playwright';

const walk = (dir) =>
	readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory()
			? walk(full)
			: entry.endsWith('.spec.ts')
				? [full]
				: [];
	});

const hasBlueprint = (spec) => {
	let dir = dirname(spec);
	while (dir.startsWith(TEST_DIR) || dir === TEST_DIR) {
		if (existsSync(join(dir, 'blueprint.json'))) return true;
		if (dir === TEST_DIR) return false;
		dir = dirname(dir);
	}
	return false;
};

// A first-line `// e2e:disabled` marker keeps a spec on disk but out of the CI
// matrix — the equivalent of a commented-out entry in cypress-push.yml.
const isDisabled = (spec) =>
	readFileSync(spec, 'utf8').split('\n', 1)[0].includes('e2e:disabled');

const projects = existsSync(TEST_DIR)
	? walk(TEST_DIR)
			.filter(hasBlueprint)
			.filter((s) => !isDisabled(s))
			.map((s) =>
				relative(TEST_DIR, s)
					.replace(/\.spec\.ts$/, '')
					.split(sep)
					.join('/'),
			)
	: [];

process.stdout.write(JSON.stringify(projects));
