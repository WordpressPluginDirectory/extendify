import { Tooltip } from '@wordpress/components';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import { __, isRTL } from '@wordpress/i18n';
import { Icon, close } from '@wordpress/icons';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { usePortal } from '@agent/hooks/usePortal';
import { useWorkflowStore } from '@agent/state/workflows';

const scopedTo = 'main.wp-block-group';
// TODO: maybe scope this a bit better?
// TODO: text in a p tag has no block class - need to handle that
const classSelectors = ['[class^="wp-block-"]', '[class*=" wp-block-"]'];
const ignored = [
	'wp-block-image',
	'wp-block-cover',
	'wp-block-video',
	'wp-block-columns',
	'wp-block-buttons',
];
// Build selector from class list: ".foo, .bar"
const selector = classSelectors.map((c) => `${scopedTo} ${c}`).join(', ');

export const DOMHighlighter = ({ busy = false }) => {
	const [rect, setRect] = useState(null);
	const mountNode = usePortal('extendify-agent-dom-mount');
	const raf = useRef(null);
	const el = useRef(null);
	const { getWorkflowsByFeature, block, setBlock } = useWorkflowStore();

	const enabled = getWorkflowsByFeature({ requires: ['block'] })?.length > 0;

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

	useEffect(() => {
		if (busy || block) return;
		if (!mountNode || !enabled) return setRect(null);

		const onMove = (e) => {
			if (raf.current) return;
			raf.current = requestAnimationFrame(() => {
				raf.current = null;
				const target = e.target;

				if (!target) return setRect(null);
				const match = target.closest(selector);
				if (!match) return setRect(null);

				// It should have a block ID
				if (!match.getAttribute('data-extendify-agent-block-id')) {
					return setRect(null);
				}

				// Ignore some blocks like columns
				if (ignored.some((c) => match.classList.contains(c))) {
					return setRect(null);
				}

				// TODO: later images?
				const hasMeaningfulText = /\S/.test(
					(match.textContent || '').replace(/\u200B/g, ''),
				);
				const innerBlockCount = Array.from(
					match.querySelectorAll(classSelectors.join(', ')),
				).filter((el) => !ignored.some((c) => el.classList.contains(c))).length;

				// Keep complexity low for now
				if (!hasMeaningfulText || innerBlockCount > 5) {
					return setRect(null);
				}

				el.current = match;
				const r = match.getBoundingClientRect();
				if (r.width <= 0 || r.height <= 0) return setRect(null);

				const { top, left, width, height } = r;
				setRect({ top, left, width, height });
			});
		};

		window.addEventListener('mousemove', onMove, { passive: true });
		return () => {
			window.removeEventListener('mousemove', onMove);
			if (raf.current) cancelAnimationFrame(raf.current);
		};
	}, [busy, mountNode, enabled, block]);

	useEffect(() => {
		const onScrollOrResize = () => {
			if (!el.current) return;
			const { top, left, width, height } = el.current.getBoundingClientRect();
			setRect({ top, left, width, height });
		};
		window.addEventListener('scroll', onScrollOrResize, { passive: true });
		window.addEventListener('resize', onScrollOrResize);
		return () => {
			window.removeEventListener('scroll', onScrollOrResize);
			window.removeEventListener('resize', onScrollOrResize);
		};
	}, [el]);

	useEffect(() => {
		if (!enabled) return;

		const onClickCapture = (e) => {
			if (!rect) return;
			// find the real element under cursor
			const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
			if (!stack[0]) return;
			if (!stack[0].closest('.wp-site-blocks')) return;
			e.preventDefault();
			e.stopPropagation();

			const match = stack[0].closest(selector);
			if (!match) return;
			setBlock(match.getAttribute('data-extendify-agent-block-id'));
			document.querySelector('#extendify-agent-chat-textarea')?.focus();
		};

		// capture=true so we stop clicks before app code or link navigation
		window.addEventListener('click', onClickCapture, { capture: true });
		return () =>
			window.removeEventListener('click', onClickCapture, { capture: true });
	}, [enabled, setBlock, rect]);

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
				<Tooltip text={__('Remove highlight', 'extendify-local')}>
					<div
						role="button"
						className={classNames(
							'fixed z-higher h-6 w-6 -translate-y-3 cursor-pointer select-none items-center justify-center rounded-full text-center font-bold ring-1 ring-black',
							{
								'-translate-x-6 rtl:translate-x-6':
									left + width >= window.innerWidth - 12,
								'-translate-x-3 rtl:translate-x-3':
									left + width < window.innerWidth,
							},
						)}
						onClick={() => setBlock(null)}
						style={{
							top,
							left: isRTL() ? 'auto' : left + width,
							right: isRTL() ? left : 'auto',
							backgroundColor: 'var(--wp--preset--color--primary, red)',
							color: 'var(--wp--preset--color--background, white)',
						}}>
						<Icon
							className="pointer-events-none fill-current leading-none"
							icon={close}
							size={18}
						/>
						<span className="sr-only">
							{__('Remove highlight', 'extendify-local')}
						</span>
					</div>
				</Tooltip>
			) : null}
			<motion.div
				initial={false}
				aria-hidden
				animate={animate}
				transition={transition}
				className="pointer-events-none fixed z-high mix-blend-hard-light outline-dashed outline-4"
				style={{
					top: 0,
					left: 0,
					willChange: 'transform,width,height,opacity',
					outlineColor: 'var(--wp--preset--color--primary, red)',
				}}
			/>
		</>,
		mountNode,
	);
};
