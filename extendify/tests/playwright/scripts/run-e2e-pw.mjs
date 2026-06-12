#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..', '..', '..');
const TEST_DIR = resolve(ROOT, 'tests/playwright');
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 2);

const walkSpecs = (dir) => {
	const out = [];
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

const hasBlueprint = (specPath) => {
	let dir = dirname(specPath);
	while (dir.startsWith(TEST_DIR) || dir === TEST_DIR) {
		if (existsSync(join(dir, 'blueprint.json'))) return true;
		if (dir === TEST_DIR) return false;
		dir = dirname(dir);
	}
	return false;
};

const projectName = (specPath) =>
	relative(TEST_DIR, specPath)
		.replace(/\.spec\.ts$/, '')
		.split(sep)
		.join('/');

// First-line `// e2e:disabled` marker — see ./discover-playwright-projects.mjs.
const isDisabled = (spec) =>
	readFileSync(spec, 'utf8').split('\n', 1)[0].includes('e2e:disabled');

const projects = existsSync(TEST_DIR)
	? walkSpecs(TEST_DIR)
			.filter(hasBlueprint)
			.filter((s) => !isDisabled(s))
			.map(projectName)
	: [];

const explicit = process.env.RUN_PROJECT;
const toRun = explicit ? [explicit] : projects;

if (toRun.length === 0) {
	console.error('No Playwright projects discovered under tests/playwright/');
	process.exit(1);
}

const runOnce = (project) =>
	new Promise((resolveFn) => {
		const child = spawn('npx', ['playwright', 'test', `--project=${project}`], {
			stdio: 'inherit',
			cwd: ROOT,
			env: { ...process.env, RUN_PROJECT: project },
		});
		child.on('exit', (code) => resolveFn(code ?? 1));
	});

const failures = [];
for (const project of toRun) {
	let code = 1;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		console.log(`\n→ ${project} (attempt ${attempt}/${MAX_ATTEMPTS})`);
		code = await runOnce(project);
		if (code === 0) break;
	}
	if (code !== 0) failures.push(project);
}

if (failures.length) {
	console.error(`\nFailed projects: ${failures.join(', ')}`);
	process.exit(1);
}
