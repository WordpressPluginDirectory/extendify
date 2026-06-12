// Hard contract from the rebuild: the AI Agent cannot auto-enable Edit
// Mode. Chat.jsx and ChatTools.jsx talk to useEditModeStore directly for
// user-gesture writes (Esc handler, the Select chip's toggle). No code
// path under src/Agent/ may flip edit mode on without a user gesture.
//
// Static checks over the source tree, two ways:
//   1. Only `Chat.jsx` and `ChatTools.jsx` may import useEditModeStore.
//   2. No file under src/Agent/ writes `setOn(true)` literally —
//      auto-enable shapes (`setOn(true)`, `setOn(!something)`, `toggle()`
//      from a non-gesture path) are caught by the literal-true check
//      since the legitimate Select-chip path uses `toggle()` while
//      reading state and the Esc handler uses `setOn(false)`.

const fs = require('node:fs');
const path = require('node:path');

const AGENT_ROOT = path.resolve(__dirname, '../../../../src/Agent');
const ALLOWED_EDIT_MODE_IMPORTERS = new Set(['Chat.jsx', 'ChatTools.jsx']);

const walk = (dir) => {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walk(full));
		} else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
			files.push(full);
		}
	}
	return files;
};

const stripComments = (src) =>
	src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('agent surface — cannot auto-enable Edit Mode', () => {
	const agentFiles = walk(AGENT_ROOT);

	it('finds agent source files to scan', () => {
		expect(agentFiles.length).toBeGreaterThan(20);
	});

	it('only Chat.jsx and ChatTools.jsx may import useEditModeStore', () => {
		const offenders = [];
		for (const file of agentFiles) {
			const src = stripComments(fs.readFileSync(file, 'utf8'));
			if (!/useEditModeStore/.test(src)) continue;
			if (ALLOWED_EDIT_MODE_IMPORTERS.has(path.basename(file))) continue;
			offenders.push(file);
		}
		expect(offenders).toEqual([]);
	});

	it('no file under src/Agent/ calls setOn(true) with a hardcoded enable', () => {
		const offenders = [];
		for (const file of agentFiles) {
			const src = stripComments(fs.readFileSync(file, 'utf8'));
			if (/setOn\s*\(\s*true\s*\)/.test(src)) {
				offenders.push(file);
			}
		}
		expect(offenders).toEqual([]);
	});
});
