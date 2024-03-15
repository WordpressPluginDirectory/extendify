import { AnimatePresence } from 'framer-motion';
import { Modal } from '@help-center/components/modal/Modal';
import { GuidedTour } from '@help-center/components/tours/GuidedTour';

export const HelpCenter = () => (
	<>
		<AnimatePresence>
			<Modal />
		</AnimatePresence>
		<GuidedTour />
	</>
);
