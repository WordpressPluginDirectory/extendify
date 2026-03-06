import { useCreateSite } from '@auto-launch/hooks/useCreateSite';
import { useRateLimitedCursor } from '@auto-launch/hooks/useRateLimitedCursor';
import { checkmark, pulser } from '@auto-launch/icons';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, offline } from '@wordpress/icons';
import { AnimatePresence, motion } from 'framer-motion';

const itemVariants = {
	enter: { opacity: 0, y: 20 },
	center: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -20 },
};
const VISIBLE_MSG_COUNT = 6;

const { adminUrl, homeUrl } = window.extSharedData;

export const CreatingSite = ({ height }) => {
	const { done } = useCreateSite();
	const pos = useRef(0);
	const [messagesD, setMessagesD] = useState([]);
	const [loadAdmin, setLoadAdmin] = useState(false);
	const messages = messagesD.slice(-VISIBLE_MSG_COUNT);
	const {
		statusMessages,
		errorMessage,
		setErrorMessage,
		errorCount,
		needToStall,
		resetErrorCount,
		setPulse,
	} = useLaunchDataStore();

	useRateLimitedCursor(
		() => {
			if (errorMessage) return false;
			if (pos.current >= statusMessages.length) return false;

			const remaining = statusMessages.length - pos.current;
			const MAX_BACKLOG = 3;

			// Skip ahead silently if backed up
			if (remaining > MAX_BACKLOG && pos.current > 0) {
				pos.current = statusMessages.length - MAX_BACKLOG;
			}

			// The colors on the pulsing dot
			const hues = [50, 100, 150, 200, 250, 300, 350].filter(
				(h) => h !== messagesD[messagesD.length - 1]?.hue,
			);
			const hue = hues[Math.floor(Math.random() * hues.length)];
			const next = { text: statusMessages[pos.current], hue };
			pos.current += 1;

			setMessagesD((prev) => [...prev, next]);
			return pos.current < statusMessages.length;
		},
		// Variable timer to feel more natural, 2.5-3.25s
		Math.floor(2500 + Math.random() * 750),
		[statusMessages.length],
	);

	useEffect(() => {
		if (!errorMessage) return;
		const timeout = setTimeout(() => {
			// Clear after 5 seconds
			setErrorMessage(null);
		}, 5000);
		return () => clearTimeout(timeout);
	}, [errorMessage, setErrorMessage]);

	useEffect(() => {
		setPulse(!done);
	}, [done]);

	useEffect(() => {
		if (!done) return;
		setLoadAdmin(true);
		const timeout = setTimeout(() => {
			window.location.replace(
				`${homeUrl}?extendify-launch-success=1&extendify-agent-onboarding=1`,
			);
		}, 3000);
		return () => clearTimeout(timeout);
	}, [done]);

	useEffect(() => {
		if (!needToStall()) return;
		const timer = setTimeout(() => {
			resetErrorCount();
		}, 10000); // reset after 10 seconds
		return () => clearTimeout(timer);
	}, [needToStall, errorCount, resetErrorCount]);

	if (needToStall()) {
		return (
			<div className="bg-white w-full h-full p-6 lg:p-12 lg:py-8 overflow-hidden text-gray-900 flex flex-col rounded-lg">
				<h2 className="text-lg text-center text-gray-900 font-semibold px-4 py-0 m-0">
					{__('We are experiencing some delays', 'extendify-local')}
				</h2>
				<div className="grow flex items-center justify-center">
					<Icon icon={offline} size={90} fill="var(--ext-design-main)" />
				</div>
				<div className="m-0 p-0 leading-tight text-sm text-center">
					{__('Pausing for a few seconds', 'extendify-local')}
				</div>
			</div>
		);
	}

	return (
		<div
			className="w-full overflow-hidden items-center justify-end flex flex-col p-6"
			style={{ height: height || 'auto' }}
		>
			<AnimatePresence initial={false} mode="popLayout">
				{/* Spacer for the first 5 messages */}
				{Array.from({ length: VISIBLE_MSG_COUNT - messages.length }).map(
					(_, index) => (
						<motion.div
							key={`spacer-${index}`}
							layout
							variants={itemVariants}
							initial="enter"
							animate="center"
							exit="exit"
							transition={{ duration: 0.3 }}
							className="m-0 mb-2 p-0 leading-tight h-7 text-lg"
						>
							&nbsp;
						</motion.div>
					),
				)}
				{messages.map(({ text, hue }, index) => {
					const lastIndex = messages.length - 1;
					const isLast = index === lastIndex;

					return (
						<motion.div
							key={text}
							layout
							variants={itemVariants}
							initial="enter"
							animate="center"
							exit="exit"
							transition={{ duration: 0.3 }}
							className="m-0 mb-2 p-0 leading-tight h-7 text-lg"
						>
							<motion.span
								layout
								initial={false}
								animate={{
									fontSize: isLast ? '1.125rem' : '0.875rem',
									fontWeight: isLast ? 600 : 300,
									filter: isLast ? undefined : 'blur(0.85px)',
								}}
								transition={{ duration: 0.5 }}
								className="inline-flex text-banner-text items-center gap-1"
							>
								<span className="inline-flex w-5 h-5 items-center justify-center">
									{isLast ? (
										<Icon
											icon={pulser}
											style={{
												color: `hsl(${hue} 100% 35% / 1)`,
											}}
										/>
									) : (
										<Icon icon={checkmark} />
									)}
								</span>
								{text}
							</motion.span>
						</motion.div>
					);
				})}
			</AnimatePresence>
			{errorMessage ? (
				<div className="absolute -bottom-12 left-0 text-center w-full text-red-600 text-xs p-2 rounded-md bg-white">
					{errorMessage}
				</div>
			) : null}
			{loadAdmin ? <AdminLoader /> : null}
		</div>
	);
};

// iframe that loads the admin in the background to make sure
// all php functions that require admin context work properly.
const AdminLoader = () => (
	<iframe
		title="Admin Loader"
		src={adminUrl}
		style={{ display: 'none' }}
		sandbox="allow-same-origin allow-scripts allow-forms"
	/>
);
