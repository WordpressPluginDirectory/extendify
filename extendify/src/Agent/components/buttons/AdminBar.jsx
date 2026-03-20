import { magic } from '@agent/icons';
import { useGlobalStore } from '@agent/state/global';
import { Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import classNames from 'classnames';
import { motion } from 'framer-motion';

// TODO: this isnt great if we allow the user to "pop out" the sidebar
const isSidebarDocked = window.extAgentData.agentPosition !== 'floating';

export const AdminBar = () => {
	const { toggleOpen, open, isMobile } = useGlobalStore();

	if (isMobile) return null;

	return (
		<motion.button
			type="button"
			initial={false}
			animate={{
				width: isSidebarDocked ? (open ? 0 : 'auto') : 'auto',
				opacity: isSidebarDocked ? (open ? 0 : 100) : 100,
			}}
			transition={{
				width: { duration: 0.3, ease: 'easeInOut' },
				opacity: { duration: 0.1, ease: 'easeInOut' },
			}}
			className={classNames(
				'items-center justify-center gap-0.5 h-full border-0 leading-extra-tight text-white md:inline-flex whitespace-nowrap hover:opacity-80',
				{ 'opacity-60': open && !isSidebarDocked },
				// Open, docked sidebar (keeps the spacing)
				{ 'mr-1 rtl:ml-1 rtl:mr-0': open && isSidebarDocked },
				{
					// Styles for when docked sidebar is open
					// Useful to put things here you don't want to animate out
					'py-0.5 px-1.5 bg-design-main text-design-text':
						!isSidebarDocked || (isSidebarDocked && !open),
				},
			)}
			onClick={() => toggleOpen()}
			aria-label={__('Open Agent', 'extendify-local')}
		>
			<Icon className="shrink-0" icon={magic} width={20} height={20} />
			<span className="px-1 leading-none">
				{__('AI Agent', 'extendify-local')}
			</span>
		</motion.button>
	);
};
