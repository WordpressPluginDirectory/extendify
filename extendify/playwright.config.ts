import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const ROOT = resolve(__dirname);
const TEST_DIR = resolve(ROOT, 'tests/playwright');
const BASE_PORT = Number(process.env.BASE_PORT ?? 9400);
const WP_VERSION = process.env.WP_VERSION ?? 'latest';
const RUN_PROJECT = process.env.RUN_PROJECT;

const walkSpecs = (dir: string): string[] => {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			out.push(...walkSpecs(full));
			continue;
		}
		if (entry.endsWith('.spec.ts')) out.push(full);
	}
	return out;
};

const closestBlueprint = (specPath: string): string | null => {
	let dir = dirname(specPath);
	while (dir.startsWith(TEST_DIR) || dir === TEST_DIR) {
		const candidate = join(dir, 'blueprint.json');
		if (existsSync(candidate)) return candidate;
		if (dir === TEST_DIR) return null;
		dir = dirname(dir);
	}
	return null;
};

const projectName = (specPath: string): string =>
	relative(TEST_DIR, specPath)
		.replace(/\.spec\.ts$/, '')
		.split(sep)
		.join('/');

// First-line `// e2e:disabled` marker — see tests/playwright/scripts/discover-playwright-projects.mjs.
// RUN_PROJECT explicitly opting in to a disabled spec still wins (for local debug).
const isDisabled = (spec: string): boolean =>
	readFileSync(spec, 'utf8').split('\n', 1)[0].includes('e2e:disabled');

const specs = existsSync(TEST_DIR)
	? walkSpecs(TEST_DIR).filter(
			(s) => !isDisabled(s) || projectName(s) === RUN_PROJECT,
		)
	: [];

const blueprintPort = new Map<string, number>();
for (const spec of specs) {
	const blueprint = closestBlueprint(spec);
	if (!blueprint) continue;
	if (!blueprintPort.has(blueprint)) {
		blueprintPort.set(blueprint, BASE_PORT + blueprintPort.size);
	}
}

const projectBlueprint = new Map<string, string>();

const allProjects = specs
	.map((spec) => {
		const blueprint = closestBlueprint(spec);
		const port = blueprint ? blueprintPort.get(blueprint) : undefined;
		if (!port || !blueprint) return null;
		const name = projectName(spec);
		projectBlueprint.set(name, blueprint);
		return {
			name,
			testMatch: relative(ROOT, spec),
			use: {
				...devices['Desktop Chrome'],
				baseURL: `http://127.0.0.1:${port}`,
			},
		};
	})
	.filter((p): p is NonNullable<typeof p> => p !== null);

const projects = RUN_PROJECT
	? allProjects.filter((p) => p.name === RUN_PROJECT)
	: allProjects;

// Only spin up the webServer(s) the selected projects actually need. Spawning
// every blueprint's playground when only one project will run wastes boot time
// and burns ports.
const activeBlueprints = new Set(
	projects.map((p) => projectBlueprint.get(p.name)).filter(Boolean) as string[],
);
const webServers = [...blueprintPort.entries()]
	.filter(([blueprint]) => activeBlueprints.has(blueprint))
	.map(([blueprint, port]) => ({
		// PHP version is pinned per-blueprint via `preferredVersions.php` — the
		// CLI `--php` flag is silently ignored by wp-playground-cli. Pinned to
		// 8.3 to dodge a PHP 8.5 deprecation in vendor/react/promise that
		// breaks ?action=rest-nonce by printing inline when WP_DEBUG_DISPLAY is
		// on. Drop the pin once react/promise ships an 8.5-compatible release.
		command: `npx wp-playground-cli server --auto-mount --blueprint=${relative(ROOT, blueprint)} --wp=${WP_VERSION} --port=${port} --internal-cookie-store=true --login=false`,
		url: `http://127.0.0.1:${port}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: 'pipe' as const,
		stderr: 'pipe' as const,
	}));

// @wordpress/e2e-test-utils-playwright's RequestUtils HEADs process.env.WP_BASE_URL
// (default http://localhost:8889 — wp-env's default port) to find the REST root,
// regardless of each request context's configured baseURL. Pin it to the selected
// project's playground port so requestUtils.login() reaches the right server.
if (projects.length > 0 && !process.env.WP_BASE_URL) {
	const firstPort = new URL(projects[0].use.baseURL).port;
	process.env.WP_BASE_URL = `http://127.0.0.1:${firstPort}`;
}

export default defineConfig({
	testDir: TEST_DIR,
	globalSetup: './tests/playwright/global-setup.ts',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	// 30s default is too tight for this wp-playground suite on cold CI — the
	// reload-based save specs run ~25-30s even locally.
	timeout: 120_000,
	// Raise the per-assertion floor from 5s to the 15s specs already hand-patch.
	expect: { timeout: 15_000 },
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		trace: 'on-first-retry',
		video: 'retain-on-failure',
		screenshot: 'only-on-failure',
		testIdAttribute: 'data-test',
	},
	webServer: webServers.length > 0 ? webServers : undefined,
	projects,
});
