import { useEffect } from '@wordpress/element';
import { AnimatePresence } from 'framer-motion';
import { Modal } from '@help-center/components/modal/Modal';
import { GuidedTour } from '@help-center/components/tours/GuidedTour';
import { useGlobalSyncStore } from '@help-center/state/globals-sync';

export const HelpCenter = () => {
	// register a custom event to hide the Help Center.
	const { setVisibility, visibility } = useGlobalSyncStore();
	useEffect(() => {
		const handle = () => {
			if (visibility === 'open') setVisibility('minimized');
		};

		window.addEventListener('extendify-hc:minimize', handle);

		return () => {
			window.removeEventListener('extendify-hc:minimize', handle);
		};
	}, [setVisibility, visibility]);

	return (
		<>
			<AnimatePresence>
				<Modal />
			</AnimatePresence>
			<GuidedTour />
		</>
	);
};
