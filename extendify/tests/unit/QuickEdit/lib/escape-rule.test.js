// Pure escape-rule decision matrix.
//
// Mirrors the click-rule shape (decideClickAction in click-rule.js):
// the decision is a pure function tested without DOM dispatch plumbing.
// Wiring (listener attach, stopPropagation, store mutations) lives in
// global-escape.js and is exercised by global-escape.test.js.
//
// Priority order:
//   1. agent block + QE on same block → clear-selection-and-agent-block
//   2. agent block staged    → clear-agent-block (cancels workflow too)
//   3. QE selection set      → clear-selection
//   4. committedSelection    → clear-committed-selection
//   5. else                  → noop (Esc must NOT flip edit mode off)
//   * edit mode off          → pass-through (the wiring layer bails early)

import { decideEscapeAction } from '@quick-edit/lib/escape-rule';

describe('decideEscapeAction — edit mode off', () => {
	it('passes through regardless of selector state', () => {
		expect(
			decideEscapeAction({
				editModeOn: false,
				hasAgentBlock: true,
				hasQuickEditSelection: true,
				hasCommittedSelection: true,
			}),
		).toEqual({ action: 'pass-through' });
	});
});

describe('decideEscapeAction — priority order', () => {
	it('agent block beats QE selection (different blocks)', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: true,
				hasQuickEditSelection: true,
				hasCommittedSelection: false,
				sameBlock: false,
			}),
		).toEqual({ action: 'clear-agent-block' });
	});

	it('agent block + QE selection on the same block collapses to one keypress', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: true,
				hasQuickEditSelection: true,
				hasCommittedSelection: false,
				sameBlock: true,
			}),
		).toEqual({ action: 'clear-selection-and-agent-block' });
	});

	it('agent block beats committedSelection', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: true,
				hasQuickEditSelection: false,
				hasCommittedSelection: true,
			}),
		).toEqual({ action: 'clear-agent-block' });
	});

	it('QE selection beats committedSelection', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: false,
				hasQuickEditSelection: true,
				hasCommittedSelection: true,
			}),
		).toEqual({ action: 'clear-selection' });
	});

	it('agent block alone returns clear-agent-block', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: true,
				hasQuickEditSelection: false,
				hasCommittedSelection: false,
			}),
		).toEqual({ action: 'clear-agent-block' });
	});

	it('QE selection alone returns clear-selection', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: false,
				hasQuickEditSelection: true,
				hasCommittedSelection: false,
			}),
		).toEqual({ action: 'clear-selection' });
	});

	it('committedSelection alone returns clear-committed-selection', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: false,
				hasQuickEditSelection: false,
				hasCommittedSelection: true,
			}),
		).toEqual({ action: 'clear-committed-selection' });
	});

	it('nothing set returns noop (Esc does not turn off edit mode)', () => {
		expect(
			decideEscapeAction({
				editModeOn: true,
				hasAgentBlock: false,
				hasQuickEditSelection: false,
				hasCommittedSelection: false,
			}),
		).toEqual({ action: 'noop' });
	});
});
