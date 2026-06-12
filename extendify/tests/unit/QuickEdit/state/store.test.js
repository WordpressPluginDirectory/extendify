import { useQuickEditStore } from '@quick-edit/state/store';

const initialState = useQuickEditStore.getState();

describe('useQuickEditStore', () => {
	beforeEach(() => {
		useQuickEditStore.setState({
			hovered: null,
			selected: null,
			dirty: {},
			saving: false,
			error: null,
			agentBlock: null,
			agentBlockCode: null,
			committedSelection: null,
		});
	});

	describe('initial state', () => {
		it('seeds with empty hover/select/dirty + idle flags', () => {
			expect(initialState.hovered).toBeNull();
			expect(initialState.selected).toBeNull();
			expect(initialState.dirty).toEqual({});
			expect(initialState.saving).toBe(false);
			expect(initialState.error).toBeNull();
			expect(initialState.agentBlock).toBeNull();
			expect(initialState.agentBlockCode).toBeNull();
			expect(initialState.committedSelection).toBeNull();
		});
	});

	describe('setHovered', () => {
		it('replaces hovered target', () => {
			const { setHovered } = useQuickEditStore.getState();
			setHovered({ blockId: 'b-1' });
			expect(useQuickEditStore.getState().hovered).toEqual({ blockId: 'b-1' });
			setHovered(null);
			expect(useQuickEditStore.getState().hovered).toBeNull();
		});

		it('does not touch other slices', () => {
			useQuickEditStore.setState({
				selected: { blockId: 'b-1' },
				dirty: { text: 'x' },
				error: 'oops',
				saving: true,
			});
			useQuickEditStore.getState().setHovered({ blockId: 'b-2' });
			const s = useQuickEditStore.getState();
			expect(s.selected).toEqual({ blockId: 'b-1' });
			expect(s.dirty).toEqual({ text: 'x' });
			expect(s.error).toBe('oops');
			expect(s.saving).toBe(true);
		});
	});

	describe('setSelected', () => {
		it('replaces selected and resets dirty + error', () => {
			useQuickEditStore.setState({
				dirty: { text: 'unsaved' },
				error: 'prior',
			});
			useQuickEditStore.getState().setSelected({ blockId: 'b-1' });
			const s = useQuickEditStore.getState();
			expect(s.selected).toEqual({ blockId: 'b-1' });
			expect(s.dirty).toEqual({});
			expect(s.error).toBeNull();
		});

		it('does not touch hovered or saving', () => {
			useQuickEditStore.setState({
				hovered: { blockId: 'h-1' },
				saving: true,
			});
			useQuickEditStore.getState().setSelected({ blockId: 'b-1' });
			const s = useQuickEditStore.getState();
			expect(s.hovered).toEqual({ blockId: 'h-1' });
			expect(s.saving).toBe(true);
		});
	});

	describe('clearSelected', () => {
		it('nulls selected and resets dirty + error', () => {
			useQuickEditStore.setState({
				selected: { blockId: 'b-1' },
				dirty: { text: 'unsaved' },
				error: 'prior',
			});
			useQuickEditStore.getState().clearSelected();
			const s = useQuickEditStore.getState();
			expect(s.selected).toBeNull();
			expect(s.dirty).toEqual({});
			expect(s.error).toBeNull();
		});
	});

	describe('setField', () => {
		it('merges values into dirty', () => {
			const { setField } = useQuickEditStore.getState();
			setField('text', 'hello');
			setField('href', 'https://example.com');
			expect(useQuickEditStore.getState().dirty).toEqual({
				text: 'hello',
				href: 'https://example.com',
			});
		});

		it('overwrites existing keys', () => {
			useQuickEditStore.getState().setField('text', 'first');
			useQuickEditStore.getState().setField('text', 'second');
			expect(useQuickEditStore.getState().dirty).toEqual({ text: 'second' });
		});

		it('keeps undefined and null distinct from "missing"', () => {
			const { setField } = useQuickEditStore.getState();
			setField('a', null);
			setField('b', undefined);
			const d = useQuickEditStore.getState().dirty;
			expect('a' in d).toBe(true);
			expect('b' in d).toBe(true);
			expect(d.a).toBeNull();
			expect(d.b).toBeUndefined();
		});
	});

	describe('setSaving / setError', () => {
		it('sets saving in isolation', () => {
			useQuickEditStore.getState().setSaving(true);
			expect(useQuickEditStore.getState().saving).toBe(true);
			useQuickEditStore.getState().setSaving(false);
			expect(useQuickEditStore.getState().saving).toBe(false);
		});

		it('sets error in isolation (does not clear dirty)', () => {
			useQuickEditStore.setState({ dirty: { text: 'x' } });
			useQuickEditStore.getState().setError('boom');
			const s = useQuickEditStore.getState();
			expect(s.error).toBe('boom');
			expect(s.dirty).toEqual({ text: 'x' });
		});
	});

	describe('setAgentBlock', () => {
		it('replaces agentBlock and clears agentBlockCode', () => {
			useQuickEditStore.setState({ agentBlockCode: 'cached html' });
			useQuickEditStore.getState().setAgentBlock({
				id: 'b-1',
				target: 'data-extendify-agent-block-id',
				hasText: true,
			});
			const s = useQuickEditStore.getState();
			expect(s.agentBlock).toMatchObject({ id: 'b-1', hasText: true });
			expect(s.agentBlockCode).toBeNull();
		});

		it('clearing agentBlock with null also clears agentBlockCode', () => {
			useQuickEditStore.setState({
				agentBlock: { id: 'b-1' },
				agentBlockCode: 'html',
			});
			useQuickEditStore.getState().setAgentBlock(null);
			const s = useQuickEditStore.getState();
			expect(s.agentBlock).toBeNull();
			expect(s.agentBlockCode).toBeNull();
		});

		it('does not touch QuickEdit canvas state (selected / dirty)', () => {
			useQuickEditStore.setState({
				selected: { blockId: 's-1' },
				dirty: { text: 'unsaved' },
			});
			useQuickEditStore.getState().setAgentBlock({ id: 'b-1' });
			const s = useQuickEditStore.getState();
			expect(s.selected).toEqual({ blockId: 's-1' });
			expect(s.dirty).toEqual({ text: 'unsaved' });
		});
	});

	describe('setCommittedSelection', () => {
		it('writes the slot', () => {
			const target = { el: 'fake-el', blockType: 'core/paragraph', blockId: 5 };
			useQuickEditStore.getState().setCommittedSelection(target);
			expect(useQuickEditStore.getState().committedSelection).toBe(target);
		});

		it('clears the slot when set to null', () => {
			useQuickEditStore.setState({
				committedSelection: { el: 'fake', blockType: 'core/group' },
			});
			useQuickEditStore.getState().setCommittedSelection(null);
			expect(useQuickEditStore.getState().committedSelection).toBeNull();
		});

		it('does not touch selected / agentBlock / dirty', () => {
			useQuickEditStore.setState({
				selected: { blockId: 's-1' },
				agentBlock: { id: 'a-1' },
				dirty: { text: 'unsaved' },
			});
			useQuickEditStore.getState().setCommittedSelection({ el: 'x' });
			const s = useQuickEditStore.getState();
			expect(s.selected).toEqual({ blockId: 's-1' });
			expect(s.agentBlock).toEqual({ id: 'a-1' });
			expect(s.dirty).toEqual({ text: 'unsaved' });
		});
	});

	describe('setAgentBlockCode', () => {
		it('writes agentBlockCode without touching agentBlock', () => {
			useQuickEditStore.setState({ agentBlock: { id: 'b-1' } });
			useQuickEditStore.getState().setAgentBlockCode('<p>hi</p>');
			const s = useQuickEditStore.getState();
			expect(s.agentBlockCode).toBe('<p>hi</p>');
			expect(s.agentBlock).toEqual({ id: 'b-1' });
		});
	});

	describe('getPatches', () => {
		it('returns one { fieldKey, value } per dirty entry', () => {
			useQuickEditStore.setState({
				dirty: { text: 'hello', href: 'https://example.com' },
			});
			const patches = useQuickEditStore.getState().getPatches();
			expect(patches).toEqual(
				expect.arrayContaining([
					{ fieldKey: 'text', value: 'hello' },
					{ fieldKey: 'href', value: 'https://example.com' },
				]),
			);
			expect(patches).toHaveLength(2);
		});

		it('returns [] when dirty is empty', () => {
			expect(useQuickEditStore.getState().getPatches()).toEqual([]);
		});
	});
});
