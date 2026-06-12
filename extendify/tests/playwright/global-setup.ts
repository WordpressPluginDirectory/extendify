import type { FullConfig } from '@playwright/test';

// wp-playground-cli opens its HTTP port before the blueprint finishes
// applying. Playwright's webServer.url check returns 200 from that
// pre-blueprint state, so tests can race past steps like installTheme +
// runPHP. Poll the REST root for the blogdescription sentinel that
// setup.php writes — last blueprint step, theme-agnostic, no auth needed.
const READY_MARKER = 'extendify-pw-blueprint-ready';
const TIMEOUT_MS = 180_000;
const POLL_MS = 1_000;

const isReady = async (baseURL: string) => {
	try {
		const res = await fetch(`${baseURL}/?rest_route=/`);
		if (!res.ok) return false;
		return (await res.text()).includes(READY_MARKER);
	} catch {
		return false;
	}
};

export default async (config: FullConfig) => {
	const baseURLs = Array.from(
		new Set(
			config.projects
				.map((p) => p.use.baseURL)
				.filter((u): u is string => Boolean(u)),
		),
	);
	await Promise.all(
		baseURLs.map(async (baseURL) => {
			const start = Date.now();
			while (Date.now() - start < TIMEOUT_MS) {
				if (await isReady(baseURL)) return;
				await new Promise((r) => setTimeout(r, POLL_MS));
			}
			throw new Error(
				`Playground at ${baseURL} did not reach ready state within ${TIMEOUT_MS / 1000}s`,
			);
		}),
	);
};
