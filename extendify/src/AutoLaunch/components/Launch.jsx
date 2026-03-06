import { CreatingSite } from '@auto-launch/components/CreatingSite';
import { DescriptionGathering } from '@auto-launch/components/DescriptionGathering';
import { motion } from 'framer-motion';

const MAX_HEIGHT_SMALL = 248;

export const Launch = ({ needsDescription, lastHeight }) => {
	if (needsDescription) {
		return (
			<motion.div
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.4 }}
			>
				<DescriptionGathering />
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, height: lastHeight || 'auto' }}
			animate={{ opacity: 1, height: MAX_HEIGHT_SMALL }}
			transition={{ duration: 0.4 }}
		>
			<CreatingSite height={MAX_HEIGHT_SMALL} />
		</motion.div>
	);
};
