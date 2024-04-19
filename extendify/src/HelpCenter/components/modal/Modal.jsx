import { __ } from '@wordpress/i18n';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { ModalContent } from '@help-center/components/modal/ModalContent';
import { Topbar } from '@help-center/components/modal/TopBar';
import { useGlobalSyncStore } from '@help-center/state/globals-sync';
import { MinimizedButton } from '../buttons/MinimizedButton';

export const Modal = () => {
	const { visibility } = useGlobalSyncStore();

	if (visibility === 'minimized') {
		return (
			<div className="extendify-help-center">
				<div className="fixed mx-auto z-high md:m-8 bottom-0 right-0 w-[420px]">
					<MinimizedButton />
				</div>
			</div>
		);
	}

	if (visibility !== 'open') return null;

	return (
		<Dialog
			ref={async () => {
				await Promise.resolve();
				if (!document?.documentElement?.style) return;
				document.documentElement.style.overflow = 'unset';
			}}
			className="extendify-help-center"
			data-test="help-center-modal"
			open={visibility === 'open'}
			static
			onClose={() => undefined}>
			<div
				// TODO: later measure the dashboard height using h-fit and apply that elsewhere
				className="fixed mx-auto z-high md:m-8 md:mt-20 max-w-[420px] w-full bottom-0 right-0 h-full max-h-[589px]">
				<motion.div
					key="help-center-modal"
					initial={{ y: 6, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 0, opacity: 0 }}
					transition={{ duration: 0.2, delay: 0.1 }}
					className="sm:flex h-full w-full relative shadow-2xl-flipped md:shadow-2xl md:rounded-md sm:overflow-hidden mx-auto">
					<Dialog.Title className="sr-only">
						{__('Extendify Help Center', 'extendify-local')}
					</Dialog.Title>
					<div className="flex flex-col w-full relative h-full bg-gray-50 md:overflow-hidden rounded-md border border-gray-400">
						<Topbar />
						<div className="overflow-y-auto flex-grow overscroll-contain">
							<ModalContent />
						</div>
					</div>
				</motion.div>
			</div>
		</Dialog>
	);
};
