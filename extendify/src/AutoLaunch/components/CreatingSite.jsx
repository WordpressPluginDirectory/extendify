import { useCreateSite } from '@auto-launch/hooks/useCreateSite';
import { useRateLimitedCursor } from '@auto-launch/hooks/useRateLimitedCursor';
import { loaderSiteCreation } from '@auto-launch/icons';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, info } from '@wordpress/icons';
import { AnimatePresence, motion } from 'framer-motion';

const { adminUrl, homeUrl } = window.extSharedData;

export const CreatingSite = ({ height }) => {
	const { done } = useCreateSite();
	const pos = useRef(0);
	const [currentMessage, setCurrentMessage] = useState(null);
	const [loadAdmin, setLoadAdmin] = useState(false);
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

			setCurrentMessage(statusMessages[pos.current]);
			pos.current += 1;

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
			window.location.replace(`${homeUrl}?extendify-launch-success=1`);
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
			<div
				className="w-full rounded-3xl border border-gray-300 bg-[#F0F0F0CC]/80 backdrop-blur-[80px] p-6 flex items-center gap-2"
				style={{
					boxShadow: '0px 4px 30px 0px #0000001A',
				}}
			>
				<div className="flex gap-2">
					<div className="w-6 shrink-0 pt-0.5">
						<Icon icon={info} size={24} />
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-lg font-semibold leading-7 text-gray-900">
							{__('We are experiencing some delays', 'extendify-local')}
						</span>
						<span className="text-base font-normal leading-6 text-gray-900">
							{__('Pausing for a few seconds', 'extendify-local')}
						</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className="w-full rounded-3xl border border-gray-300 bg-gray-100/80 backdrop-blur-2xl shadow-md flex flex-col items-center justify-center gap-3 relative"
			style={{
				height: height || 'auto',
			}}
		>
			<div className="text-design-main">{loaderSiteCreation}</div>
			<div className="h-5 overflow-hidden">
				<AnimatePresence mode="wait">
					{currentMessage ? (
						<motion.p
							key={currentMessage}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="m-0 text-sm font-medium leading-5 text-center status-animation"
						>
							{currentMessage}
						</motion.p>
					) : null}
				</AnimatePresence>
			</div>
			{errorMessage ? (
				<div
					className="absolute left-0 w-full rounded-3xl border border-gray-300 bg-[#F0F0F0CC] backdrop-blur-[80px] px-6 py-3 flex items-center gap-2"
					style={{
						top: 'calc(100% + 24px)',
						boxShadow: '0px 4px 30px 0px #0000001A',
					}}
				>
					<Icon icon={info} size={24} />
					<span className="text-sm font-medium leading-5 text-gray-900">
						{errorMessage}
					</span>
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
