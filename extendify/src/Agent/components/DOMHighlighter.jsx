import { usePortal } from '@agent/hooks/usePortal';
import { useWorkflowStore } from '@agent/state/workflows';
import { useQuickEditStore } from '@quick-edit/state/store';
import apiFetch from '@wordpress/api-fetch';
import {
	createPortal,
	useCallback,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { close, Icon } from '@wordpress/icons';
import { addQueryArgs } from '@wordpress/url';
import { motion } from 'framer-motion';

// Render-only after the selector unification: `agentBlock` is set
// by Quick Edit's Ask AI flow (or future workflows), and this component
// draws the outline + X-close indicator. Hover-bar owns hover + click
// selection on the live page; DOMHighlighter no longer listens for either.
export const DOMHighlighter = ({ busy = false }) => {
	const [rect, setRect] = useState(null);
	const mountNode = usePortal('extendify-agent-dom-mount');
	const el = useRef(null);
	const { getWorkflowsByFeature } = useWorkflowStore();
	const block = useQuickEditStore((s) => s.agentBlock);
	const selected = useQuickEditStore((s) => s.selected);
	const setBlock = useQuickEditStore((s) => s.setAgentBlock);
	const setBlockCode = useQuickEditStore((s) => s.setAgentBlockCode);
	const enabled = getWorkflowsByFeature({ requires: ['block'] })?.length > 0;
	// When the QE canvas is mounted on the same block the agent is staged
	// on, this overlay must NOT intercept clicks — otherwise text-selection
	// inside the contenteditable underneath is eaten by the outline.
	const sameBlockAsQE =
		selected?.blockId != null &&
		block?.id != null &&
		String(selected.blockId) === String(block.id);

	const clearBlock = useCallback(() => {
		setBlock(null);
		setRect(null);
		el.current = null;
	}, [setBlock, setRect]);

	useEffect(() => {
		if (!block?.id) return;
		const ac = new AbortController();
		const postId = window.extAgentData?.context?.postId;
		if (!postId) return;
		const queryArgs = {
			postId: String(postId),
			blockId: String(block.id),
		};

		const isAlive = { current: true };
		(async () => {
			const res = await apiFetch({
				path: addQueryArgs(`extendify/v1/agent/get-block-code`, queryArgs),
				signal: ac.signal,
			}).catch(() => ({})); // Agent will get it later if fails
			if (!res.block || !isAlive.current || ac.signal.aborted) return;
			setBlockCode(res.block);
		})();
		return () => {
			ac.abort();
			isAlive.current = false;
		};
	}, [setBlockCode, block]);

	// Re-syncs the rect for programmatic block changes (e.g. Ask AI)
	// and after the wp-site-blocks open/close transform settles.
	useEffect(() => {
		if (!block?.id) return;
		const attr = block.target || 'data-extendify-agent-block-id';
		const match = document.querySelector(
			`[${attr}="${CSS.escape(String(block.id))}"]`,
		);
		if (!match) return;
		el.current = match;

		const measure = () => {
			const r = match.getBoundingClientRect();
			if (r.width <= 0 || r.height <= 0) return;
			setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
		};
		measure();

		// transitionend covers the panel-open/close transform; the
		// timeouts are belt-and-braces if transitions are disabled.
		const wsb = document.querySelector('.wp-site-blocks');
		const onTransitionEnd = (e) => {
			if (e.propertyName === 'transform') measure();
		};
		wsb?.addEventListener('transitionend', onTransitionEnd);
		const t1 = window.setTimeout(measure, 80);
		const t2 = window.setTimeout(measure, 360);

		return () => {
			wsb?.removeEventListener('transitionend', onTransitionEnd);
			window.clearTimeout(t1);
			window.clearTimeout(t2);
		};
	}, [block]);

	useEffect(() => {
		const handle = () => {
			setRect(null);
			el.current = null;
		};
		window.addEventListener('extendify-agent:remove-block-highlight', handle);
		return () =>
			window.removeEventListener(
				'extendify-agent:remove-block-highlight',
				handle,
			);
	}, []);

	// Use capture phase for `scroll` so we hear it on any scrollable
	// ancestor (e.g. wp-site-blocks when something repositions it as
	// the page scroll container). Bubble-phase `scroll` doesn't
	// propagate, so a window-only listener misses those.
	useEffect(() => {
		const onScrollOrResize = () => {
			if (!el.current) return;
			const { top, left, width, height } = el.current.getBoundingClientRect();
			setRect({ top, left, width, height });
		};
		window.addEventListener('scroll', onScrollOrResize, {
			passive: true,
			capture: true,
		});
		window.addEventListener('resize', onScrollOrResize);
		return () => {
			window.removeEventListener('scroll', onScrollOrResize, {
				capture: true,
			});
			window.removeEventListener('resize', onScrollOrResize);
		};
	}, [el]);

	useEffect(() => {
		if (!el.current) return;

		const resizeObserver = new ResizeObserver(() => {
			if (!el.current) return;
			const { top, left, width, height } = el.current.getBoundingClientRect();
			setRect({ top, left, width, height });
		});

		resizeObserver.observe(el.current);

		return () => {
			resizeObserver.disconnect();
		};
	}, [el.current]);

	// Workflows can mutate the page while the outline is up: a tool that
	// re-renders the block produces a new DOM node with the same
	// data-extendify-agent-block-id, and ancestor reflows can shift the
	// element without changing its own size (ResizeObserver misses both).
	// Re-query and re-measure on any wp-site-blocks subtree mutation,
	// rAF-debounced so a burst of mutations costs one measurement.
	useEffect(() => {
		if (!block?.id) return;
		const root = document.querySelector('.wp-site-blocks');
		if (!root) return;
		const attr = block.target || 'data-extendify-agent-block-id';
		const sel = `[${attr}="${CSS.escape(String(block.id))}"]`;

		let rafId = 0;
		const observer = new MutationObserver(() => {
			if (rafId) return;
			rafId = window.requestAnimationFrame(() => {
				rafId = 0;
				const match = document.querySelector(sel);
				if (!match) return;
				el.current = match;
				const r = match.getBoundingClientRect();
				if (r.width <= 0 || r.height <= 0) return;
				setRect({
					top: r.top,
					left: r.left,
					width: r.width,
					height: r.height,
				});
			});
		});
		observer.observe(root, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		return () => {
			observer.disconnect();
			if (rafId) window.cancelAnimationFrame(rafId);
		};
	}, [block]);

	useEffect(() => {
		if (!enabled) return;
		const root = document.querySelector('.wp-site-blocks');
		if (!root) return;
		root.classList.add('extendify-agent-highlighter-mode');
		return () => root.classList.remove('extendify-agent-highlighter-mode');
	}, [enabled]);

	useEffect(() => {
		if (!busy) return;
		const root = document.querySelector('.wp-site-blocks');
		if (!root) return;
		root.classList.add('extendify-agent-busy');
		return () => root.classList.remove('extendify-agent-busy');
	}, [busy]);

	if (!enabled || !rect || !mountNode) return null;

	const { top, left, width, height } = rect;
	const animate = { x: left, y: top, width, height, opacity: 1 };
	const transition = {
		type: 'spring',
		stiffness: 700,
		damping: 40,
		mass: 0.25,
	};
	return createPortal(
		<>
			{block && !busy ? (
				// biome-ignore lint: Using <button> is complicated with unknown themes
				<div
					role="button"
					className={
						'fixed z-9 h-6 w-6 -translate-y-3.5 cursor-pointer select-none flex items-center justify-center rounded-full text-center font-bold ring-1 ring-black'
					}
					tabIndex={0}
					onClick={clearBlock}
					onKeyDown={clearBlock}
					style={{
						top,
						left: width / 2 + left - 12,
						backgroundColor: 'var(--wp--preset--color--primary, red)',
						color: 'var(--wp--preset--color--background, white)',
					}}
				>
					<Icon
						className="pointer-events-none fill-current leading-none"
						icon={close}
						size={18}
					/>
					<span className="sr-only">
						{__('Remove highlight', 'extendify-local')}
					</span>
				</div>
			) : null}
			<motion.div
				initial={false}
				aria-hidden
				animate={animate}
				transition={transition}
				className="fixed z-8 mix-blend-hard-light outline-dashed outline-4"
				style={{
					top: 0,
					left: 0,
					willChange: 'transform,width,height,opacity',
					outlineColor: 'var(--wp--preset--color--primary, red)',
					pointerEvents: block && !busy && !sameBlockAsQE ? 'auto' : 'none',
				}}
			/>
		</>,
		mountNode,
	);
};
