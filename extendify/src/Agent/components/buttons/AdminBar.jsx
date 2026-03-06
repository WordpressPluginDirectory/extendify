import { magic, magicAnimated } from '@agent/icons';
import { useGlobalStore } from '@agent/state/global';
import { Icon } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import classNames from 'classnames';
import { motion } from 'framer-motion';

// TODO: this isnt great if we allow the user to "pop out" the sidebar
const isSidebarDocked = window.extAgentData.agentPosition !== 'floating';

export const AdminBar = () => {
	const { toggleOpen, open, isMobile } = useGlobalStore();
	const [animate, setAnimate] = useState(false);
	const [animateIcon, setAnimateIcon] = useState(false);
	const pageLoaded = useRef(false);

	useEffect(() => {
		// Don't run this on the first page load
		if (!pageLoaded.current) {
			pageLoaded.current = true;
			return;
		}
		if (open || isMobile) return;
		setAnimate(true);
		setAnimateIcon(true);
		const id = setTimeout(() => {
			setAnimate(false);
		}, 1500);
		const iconId = setTimeout(() => {
			setAnimateIcon(false);
		}, 5000);
		return () => {
			clearTimeout(id);
			clearTimeout(iconId);
		};
	}, [open, isMobile]);

	if (isMobile) return null;

	return (
		<motion.button
			type="button"
			initial={false}
			animate={{
				width: isSidebarDocked ? (open ? 0 : 'auto') : 'auto',
				opacity: isSidebarDocked ? (open ? 0 : 100) : 100,
			}}
			transition={{ duration: 0.3, ease: 'easeInOut' }}
			className={classNames(
				'm-1 items-center justify-center rounded-xs border-0 bg-wp-theme-main p-0.5 leading-extra-tight text-white ring-offset-[#1D2327] focus:outline-hidden focus:ring-wp focus:ring-wp-theme-main focus:ring-offset-1 md:inline-flex whitespace-nowrap',
				{ 'opacity-60': open && !isSidebarDocked },
			)}
			onClick={() => {
				if (open) setAnimate(true);
				toggleOpen();
			}}
			aria-label={__('Open Agent', 'extendify-local')}
		>
			<Icon
				className="shrink-0"
				icon={animateIcon ? magicAnimated : magic}
				width={20}
				height={20}
			/>
			<span
				className={classNames('px-1 leading-none', {
					'extendify-gradient-animation': animate,
				})}
			>
				{__('AI Agent', 'extendify-local')}
			</span>
		</motion.button>
	);
};
