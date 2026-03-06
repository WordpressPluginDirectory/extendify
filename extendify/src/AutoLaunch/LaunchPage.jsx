import { Launch } from '@auto-launch/components/Launch';
import { Logo } from '@auto-launch/components/Logo';
import { MovingGradient } from '@auto-launch/components/MovingGradients';
import { NeedsTheme } from '@auto-launch/components/NeedsTheme';
import { RestartLaunchModal } from '@auto-launch/components/RestartLaunchModal';
import { ViewportPulse } from '@auto-launch/components/ViewportPulse';
import { updateOption } from '@auto-launch/functions/wp';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockTypes } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { checkIn } from './functions/insights';

export const LaunchPage = () => {
	const theme = useSelect((select) => select('core').getCurrentTheme());
	// Checking `theme` here makes sure the data is populated
	const needsTheme = theme && theme?.textdomain !== 'extendable';

	const oldPages = window.extLaunchData.resetSiteInformation.pagesIds ?? [];
	const needsToReset = oldPages.length > 0;

	const { title, descriptionRaw } = useLaunchDataStore();
	const needsDescription = !(title || descriptionRaw);

	const containerRef = useRef(null);

	useEffect(() => {
		// translators: Launch is a noun.
		document.title = __('Launch - AI-Powered Web Creation', 'extendify-local');
		updateOption('extendify_launch_loaded', new Date().toISOString());
		// We load core blocks so we can parse them
		if (getBlockTypes().length === 0) registerCoreBlocks();

		checkIn({ stage: 'launch_page' });
	}, []);

	if (needsTheme) {
		return (
			<Wrapper>
				<div className="bg-white w-full max-w-3xl rounded-lg border border-design-main/60 relative z-10">
					<NeedsTheme />
				</div>
			</Wrapper>
		);
	}

	if (needsToReset) {
		return (
			<Wrapper>
				<div className="bg-white w-full max-w-3xl rounded-lg border border-design-main/60 relative z-10">
					<RestartLaunchModal pages={oldPages} />
				</div>
			</Wrapper>
		);
	}

	return (
		<Wrapper>
			<AnimatePresence mode="wait" initial={false}>
				<TheTitle needsDescription={needsDescription} />
			</AnimatePresence>
			<div
				ref={containerRef}
				className="w-full max-w-3xl relative z-10 border border-design-main/60 rounded-md"
			>
				<AnimatePresence mode="wait">
					<Launch
						key={needsDescription ? 'description-launch' : 'creating-launch'}
						needsDescription={needsDescription}
						lastHeight={containerRef.current?.offsetHeight}
					/>
				</AnimatePresence>
			</div>
		</Wrapper>
	);
};

const Wrapper = ({ children }) => {
	const { pulse } = useLaunchDataStore();

	return (
		<div style={{ zIndex: 99999 + 1 }} className="fixed inset-0 bg-white">
			<div className="relative h-dvh bg-banner-main text-banner-text text-base flex items-center justify-center">
				<div className="relative w-full flex items-center justify-center">
					<div className="absolute left-1/2 -translate-x-1/2 -top-16 z-50">
						<Logo />
					</div>
					<div className="flex flex-col w-full items-center">{children}</div>
				</div>
			</div>
			<MovingGradient />
			{pulse ? <ViewportPulse /> : null}
		</div>
	);
};

const TheTitle = ({ needsDescription }) => {
	if (needsDescription) {
		return (
			<motion.h2
				className="text-3xl text-pretty text-banner-text font-semibold px-4 py-0 m-0 mb-4"
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.4 }}
			>
				{__('Describe the website you want to build', 'extendify-local')}
			</motion.h2>
		);
	}

	return (
		<motion.h2
			className="text-3xl text-pretty text-banner-text font-semibold px-4 py-0 m-0 mb-4"
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.4 }}
		>
			{__('Creating your site now', 'extendify-local')}
		</motion.h2>
	);
};
