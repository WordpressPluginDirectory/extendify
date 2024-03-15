import { useRouter } from '@help-center/hooks/useRouter';

// import { motion, AnimatePresence } from 'framer-motion';

export const ModalContent = () => {
	const { CurrentPage } = useRouter();

	return (
		<div className="w-full h-full">
			<CurrentPage />
		</div>
	);
};
