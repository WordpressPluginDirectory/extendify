import { usePortal } from '@agent/hooks/usePortal';
import { useGlobalStore } from '@agent/state/global';
import { createPortal, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
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
	useLayoutShift(open);

	const closeAgent = () => {
		setOpen(false);
		window.dispatchEvent(new CustomEvent('extendify-agent:closed-button'));
	};

	useEffect(() => {
		if (open) return;
		if (!mountNode?.contains(document.activeElement)) return;
		document.activeElement?.blur();
	}, [open]);

	if (!mountNode) return null;

	// A border that sits around the entire browser to look like the sidebar is inside it
	const frameAnim = {
		open: {
			top: FRAME_WIDTH,
			right: FRAME_WIDTH,
			bottom: FRAME_WIDTH,
			left: SIDEBAR_WIDTH,
			boxShadow: '#e0e0e0 0px 0px 0px 9999px',
			borderRadius: '1rem',
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
					<motion.div
						className="absolute rounded-2xl shadow-xl"
						style={{
							top: FRAME_WIDTH,
							right: FRAME_WIDTH,
							bottom: FRAME_WIDTH,
							left: SIDEBAR_WIDTH,
						}}
						initial={false}
						animate={{ opacity: open ? 1 : 0 }}
						transition={{
							duration: 0.15,
							delay: open ? ANIMATE_TIME / 1000 : 0,
						}}
					/>
				</div>,
				frameNode,
			)
		: null;

	const sidebar = mountNode
		? createPortal(
				<motion.div
					style={{ width: SIDEBAR_WIDTH }}
					className=" fixed top-0 bottom-0 left-0 w-96 flex-col z-higher border-transparent border-8"
					id="extendify-agent-sidebar"
					initial={false}
					inert={open ? undefined : ''}
					animate={{ x: open ? 0 : -SIDEBAR_WIDTH }}
					transition={{ duration: ANIMATE_TIME / 1000, ease: 'easeInOut' }}
				>
					<div className="h-full flex flex-col shadow-lg rounded-2xl overflow-hidden bg-white">
						<div className="group flex shrink-0 items-center justify-between overflow-hidden bg-banner-main text-banner-text">
							<div className="flex h-full grow items-center justify-between gap-1 p-0 py-2.5">
								<div className="flex h-5 px-4 max-w-36 overflow-hidden">
									<img
										className="max-h-full max-w-full object-contain"
										src={window.extSharedData.partnerLogo}
										alt={window.extSharedData.partnerName}
									/>
								</div>
							</div>
							<div className="flex gap-1 h-full items-center p-2">
								<OptionsPopover />
								<button
									type="button"
									className="relative z-10 flex justify-center h-6 w-6 items-center border-0 bg-banner-main text-banner-text outline-hidden ring-design-main focus:shadow-none focus:outline-hidden focus-visible:outline-design-main focus:ring-2 hover:opacity-80 rounded-sm"
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
					</div>
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

export const useLayoutShift = (open) => {
	const ease = 'ease-in-out';
	const t = (props) =>
		props.map((p) => `${p} ${ANIMATE_TIME}ms ${ease}`).join(', ');
	const firstRun = useRef(true);

	useEffect(() => {
		const siteBlocks = document.querySelector('.wp-site-blocks');
		const wpadminbar = document.querySelector('#wpadminbar');

		if (!firstRun.current) {
			if (siteBlocks) {
				siteBlocks.style.transition = t([
					'margin-left',
					'margin-top',
					'margin-right',
					'margin-bottom',
				]);
			}
			if (wpadminbar) {
				wpadminbar.style.transition = t([
					'margin-left',
					'margin-top',
					'margin-right',
					'border-radius',
					'max-width',
				]);
			}
		} else {
			firstRun.current = false;
		}

		const raf = requestAnimationFrame(() => {
			const fw = open ? `${FRAME_WIDTH}px` : '0px';
			const ml = open ? `${SIDEBAR_WIDTH}px` : '0px';

			if (siteBlocks) {
				Object.assign(siteBlocks.style, {
					marginTop: fw,
					marginRight: fw,
					marginBottom: fw,
					marginLeft: ml,
				});
			}

			if (wpadminbar) {
				Object.assign(wpadminbar.style, {
					marginTop: fw,
					marginRight: fw,
					marginBottom: '0px',
					marginLeft: ml,
					borderRadius: open ? '8px 8px 0 0' : '0',
					maxWidth: open
						? `calc(100% - ${SIDEBAR_WIDTH + FRAME_WIDTH}px)`
						: '100%',
				});
			}
		});

		return () => {
			cancelAnimationFrame(raf);
			if (siteBlocks) {
				Object.assign(siteBlocks.style, {
					transition: '',
					marginTop: '',
					marginRight: '',
					marginBottom: '',
					marginLeft: '',
				});
			}
			if (wpadminbar) {
				Object.assign(wpadminbar.style, {
					transition: '',
					marginTop: '',
					marginRight: '',
					marginBottom: '',
					marginLeft: '',
					borderRadius: '',
					maxWidth: '',
				});
			}
		};
	}, [open]);
};
