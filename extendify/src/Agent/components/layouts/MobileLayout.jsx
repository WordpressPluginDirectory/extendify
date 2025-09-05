import { Tooltip } from '@wordpress/components';
import { createPortal, useEffect } from '@wordpress/element';
import { __, _x } from '@wordpress/i18n';
import { Icon, close } from '@wordpress/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { usePortal } from '@agent/hooks/usePortal';
import { useGlobalStore } from '@agent/state/global';

export const MobileLayout = ({ children }) => {
	const mountNode = usePortal('extendify-agent-mount');
	const { open, setOpen } = useGlobalStore();
	const closeAgent = () => setOpen(false);

	useEffect(() => {
		if (!mountNode || !open) return;
		// prevent scroll when open
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	}, [open, mountNode]);

	if (!mountNode || !open) return null;

	return createPortal(
		<div className="fixed inset-0 z-max-1 flex items-center justify-center">
			<div className="pointer-events-none absolute inset-0 bg-black/70" />
			<AnimatePresence>
				<motion.div
					key="agent-popout-modal"
					id="extendify-agent-popout-modal"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ y: 0, opacity: 0 }}
					transition={{ duration: 0.4, delay: 0.1 }}
					className="fixed bottom-[2vh] z-high flex h-full max-h-[80vh] w-full max-w-[90vw] flex-col rounded-lg border border-solid border-gray-600 bg-white shadow-2xl-flipped rtl:left-0 rtl:right-auto">
					<div className="group flex shrink-0 items-center justify-between overflow-hidden rounded-t-[calc(0.5rem-1px)] bg-banner-main text-banner-text">
						<div className="flex h-full flex-grow items-center justify-between gap-1 p-0 py-3">
							<div className="flex h-5 justify-center gap-2 px-4 rtl:after:-right-0">
								<div className="flex h-5 max-w-[9rem] overflow-hidden">
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
						<Tooltip text={__('Close window', 'extendify-local')}>
							<button
								type="button"
								className="relative z-10 flex h-full items-center rounded-none border-0 bg-banner-main py-3 pe-4 ps-2 text-banner-text outline-none ring-design-main focus:shadow-none focus:outline-none focus-visible:outline-design-main"
								onClick={closeAgent}>
								<Icon
									className="pointer-events-none fill-current leading-none"
									icon={close}
									size={18}
								/>
								<span className="sr-only">
									{__('Close window', 'extendify-local')}
								</span>
							</button>
						</Tooltip>
					</div>
					{children}
				</motion.div>
			</AnimatePresence>
		</div>,
		mountNode,
	);
};
