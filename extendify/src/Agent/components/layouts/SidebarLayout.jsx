import { usePortal } from '@agent/hooks/usePortal';
import { useGlobalStore } from '@agent/state/global';
import { createPortal, useEffect, useRef } from '@wordpress/element';
import { __, _x } from '@wordpress/i18n';
import { close, Icon } from '@wordpress/icons';
import { motion } from 'framer-motion';
import { OptionsPopover } from '../OptionsPopover';

const SIDEBAR_WIDTH = 384; // 96 * 4 (w-96)
const FRAME_WIDTH = 8; // border-8
const ANIMATE_TIME = 300;

export const SidebarLayout = ({ children }) => {
	const mountNode = usePortal('extendify-agent-sidebar-mount');
	const frameNode = usePortal('extendify-agent-border-frame-mount');
	const { open, setOpen } = useGlobalStore();
	const firstRun = useRef(true);

	const closeAgent = () => {
		setOpen(false);
		window.dispatchEvent(new CustomEvent('extendify-agent:closed-button'));
	};

	useEffect(() => {
		if (open) return;
		if (!mountNode?.contains(document.activeElement)) return;
		document.activeElement?.blur();
	}, [open]);

	useEffect(() => {
		const siteBlocks = document.querySelector('.wp-site-blocks');
		const wpadminbar = document.querySelector('#wpadminbar');
		if (!siteBlocks && !wpadminbar) return;

		if (siteBlocks && !firstRun.current) {
			siteBlocks.style.transition = `margin-left ${ANIMATE_TIME}ms ease-in-out, margin-top ${ANIMATE_TIME}ms ease-in-out, margin-right ${ANIMATE_TIME}ms ease-in-out, margin-bottom ${ANIMATE_TIME}ms ease-in-out`;
		}

		if (wpadminbar && !firstRun.current) {
			wpadminbar.style.transition = `margin-left ${ANIMATE_TIME}ms ease-in-out, margin-top ${ANIMATE_TIME}ms ease-in-out, margin-right ${ANIMATE_TIME}ms ease-in-out, border-radius ${ANIMATE_TIME}ms ease-in-out, max-width ${ANIMATE_TIME}ms ease-in-out`;
			wpadminbar.style.maxWidth = '100%';
		}

		// To prevent animation on page load.
		if (firstRun.current) firstRun.current = false;

		const raf = requestAnimationFrame(() => {
			if (siteBlocks) {
				siteBlocks.style.marginTop = open ? `${FRAME_WIDTH}px` : '0px';
				siteBlocks.style.marginRight = open ? `${FRAME_WIDTH}px` : '0px';
				siteBlocks.style.marginBottom = open ? `${FRAME_WIDTH}px` : '0px';
				siteBlocks.style.marginLeft = open ? `${SIDEBAR_WIDTH}px` : '0px';
			}

			if (wpadminbar) {
				wpadminbar.style.marginTop = open ? `${FRAME_WIDTH}px` : '0px';
				wpadminbar.style.marginRight = open ? `${FRAME_WIDTH}px` : '0px';
				wpadminbar.style.marginBottom = '0px';
				wpadminbar.style.marginLeft = open ? `${SIDEBAR_WIDTH}px` : '0px';
				wpadminbar.style.borderRadius = open ? '8px 8px 0 0' : '0';
				wpadminbar.style.maxWidth = open
					? `calc(100% - ${SIDEBAR_WIDTH + FRAME_WIDTH}px)`
					: '100%';
			}
		});

		return () => cancelAnimationFrame(raf);
	}, [open]);

	if (!mountNode) return null;

	// A border that sits around the entire browser to look like the sidebar is inside it
	const frameAnim = {
		open: {
			top: FRAME_WIDTH,
			right: FRAME_WIDTH,
			bottom: FRAME_WIDTH,
			left: SIDEBAR_WIDTH,
			boxShadow:
				'rgb(255, 255, 255) 0px 0px 0px 9999px, inset 0px 0px 6px rgb(0 0 0 / 20%)',
			borderRadius: 17,
		},
		closed: {
			inset: 0,
			boxShadow: '0 0 0 0 #fff',
			borderRadius: 0,
		},
	};

	const frameBar = frameNode
		? createPortal(
				<div className="fixed inset-0 pointer-events-none z-high">
					<motion.div
						className="absolute overflow-hidden"
						initial={false}
						animate={open ? 'open' : 'closed'}
						variants={frameAnim}
						transition={{ duration: ANIMATE_TIME / 1000, ease: 'easeInOut' }}
					/>
				</div>,
				frameNode,
			)
		: null;

	const sidebar = mountNode
		? createPortal(
				<motion.div
					style={{ width: SIDEBAR_WIDTH }}
					className="h-dvh fixed bottom-0 left-0 flex w-96 flex-col bg-white z-higher"
					id="extendify-agent-sidebar"
					initial={false}
					inert={open ? undefined : ''}
					animate={{ x: open ? 0 : -SIDEBAR_WIDTH }}
					transition={{ duration: ANIMATE_TIME / 1000, ease: 'easeInOut' }}
				>
					<div className="group flex shrink-0 items-center justify-between overflow-hidden bg-banner-main text-banner-text">
						<div className="flex h-full grow items-center justify-between gap-1 p-0 py-3">
							<div className="flex h-5 justify-center gap-2 px-4 rtl:after:right-0">
								<div className="flex h-5 max-w-36 overflow-hidden">
									<img
										className="max-h-full max-w-full object-contain"
										src={window.extSharedData.partnerLogo}
										alt={window.extSharedData.partnerName}
									/>
								</div>
								<div className="flex items-center rounded-lg bg-banner-text px-2 font-sans text-xs leading-none text-banner-main">
									{_x('beta', 'Feature in beta status', 'extendify-local')}
								</div>
							</div>
						</div>
						<div className="flex gap-1 p-2">
							<OptionsPopover />
							<button
								type="button"
								className="relative z-10 flex justify-center h-6 w-6 items-center border-0 bg-banner-main text-banner-text outline-hidden ring-design-main focus:shadow-none focus:outline-hidden focus-visible:outline-design-main focus:ring-2 hover:bg-gray-100 rounded-md"
								onClick={closeAgent}
							>
								<Icon
									className="pointer-events-none fill-current leading-none"
									icon={close}
									size={18}
								/>
								<span className="sr-only">
									{__('Close window', 'extendify-local')}
								</span>
							</button>
						</div>
					</div>
					{open ? children : null}
				</motion.div>,
				mountNode,
			)
		: null;

	return (
		<>
			{frameBar}
			{sidebar}
		</>
	);
};
