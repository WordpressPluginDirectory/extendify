import { Launch } from '@auto-launch/components/Launch';
import { Logo } from '@auto-launch/components/Logo';
import { MovingGradient } from '@auto-launch/components/MovingGradients';
import { NeedsTheme } from '@auto-launch/components/NeedsTheme';
import { RestartLaunchModal } from '@auto-launch/components/RestartLaunchModal';
import { ViewportPulse } from '@auto-launch/components/ViewportPulse';
import { getAbTest } from '@auto-launch/functions/getAbTest';
import { preLaunchFunctions } from '@auto-launch/functions/setup';
import { updateOption } from '@auto-launch/functions/wp';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockTypes } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { chevronLeft, Icon } from '@wordpress/icons';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { checkIn } from './functions/insights';

export const LaunchPage = () => {
	const theme = useSelect((select) => select('core').getCurrentTheme());
	// Checking `theme` here makes sure the data is populated
	const needsTheme = theme && theme?.textdomain !== 'extendable';

	const oldPages = window.extLaunchData.resetSiteInformation.pagesIds ?? [];
	const needsToReset = oldPages.length > 0;

	const { title, descriptionRaw, go, urlParams, designBuild } =
		useLaunchDataStore();
	const skipDescription =
		Boolean(urlParams?.['build-id']) ||
		designBuild ||
		((title || descriptionRaw) && go);
	const showExitLink =
		!skipDescription && !window.extLaunchData?.hideAutoLaunchExitLink;
	const showTitle = getAbTest('AutoLaunch.ShowTitle').variant === 'B';

	const containerRef = useRef(null);

	useEffect(() => {
		// translators: Launch is a noun.
		document.title = __('Launch - AI-Powered Web Creation', 'extendify-local');
		updateOption('extendify_launch_loaded', new Date().toISOString());
		// We load core blocks so we can parse them
		if (getBlockTypes().length === 0) registerCoreBlocks();

		preLaunchFunctions();
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
				<div className="w-full max-w-2xl rounded-3xl border bg-gray-100/80 backdrop-blur-2xl shadow-md relative z-10 border-gray-300">
					<RestartLaunchModal pages={oldPages} />
				</div>
			</Wrapper>
		);
	}

	return (
		<Wrapper>
			<AnimatePresence mode="wait" initial={false}>
				<TheTitle skipDescription={skipDescription} />
			</AnimatePresence>
			<div ref={containerRef} className="w-full max-w-2xl relative z-10">
				<AnimatePresence mode="wait">
					<Launch
						key={skipDescription ? 'description-launch' : 'creating-launch'}
						skipDescription={skipDescription}
						lastHeight={containerRef.current?.offsetHeight}
					/>
				</AnimatePresence>
			</div>
			{showExitLink && (
				<div
					className={classNames('flex w-full', {
						'mt-6': showTitle,
						'py-8 px-6 absolute bottom-0 left-0 z-10': !showTitle,
					})}
				>
					<ExitLink />
				</div>
			)}
		</Wrapper>
	);
};

const Wrapper = ({ children }) => {
	const { pulse } = useLaunchDataStore();

	return (
		<div style={{ zIndex: 99999 + 1 }} className="fixed inset-0 bg-white">
			<div className="relative h-dvh bg-banner-main text-banner-text text-base flex flex-col items-center justify-between">
				<div className="relative w-full flex flex-col items-center p-6 flex-1 min-h-0 overflow-y-auto">
					<div className="w-full flex flex-col items-center gap-5 md:gap-8 m-auto">
						<div className="mb-4">
							<Logo />
						</div>
						{children}
					</div>
				</div>
			</div>
			<MovingGradient />
			{pulse ? <ViewportPulse /> : null}
		</div>
	);
};

const ExitLink = () => {
	return (
		<a
			className="inline-flex items-center gap-0.5 text-sm text-banner-text opacity-70 hover:opacity-100 transition-opacity"
			href={window.extSharedData.adminUrl}
			onClick={() => checkIn({ stage: 'exit_to_wp_admin' })}
		>
			<Icon fill="currentColor" icon={chevronLeft} size={20} />
			{__('WP Admin Dashboard', 'extendify-local')}
		</a>
	);
};

const TheTitle = ({ skipDescription }) => {
	const useOldHeader =
		getAbTest('AutoLaunch.HeaderParagraphOld').variant === 'B';
	if (skipDescription) return null;

	const headingClass =
		'text-xl md:text-2xl text-pretty text-banner-text font-semibold p-0 m-0 text-center';
	const transition = {
		animate: { opacity: 1 },
		exit: { opacity: 0 },
		transition: { duration: 0.4 },
	};

	if (useOldHeader) {
		return (
			<motion.div className="flex flex-col items-center gap-2" {...transition}>
				<h2 className={headingClass}>
					{__('Tell Us About Your Website', 'extendify-local')}
				</h2>
				<p className="text-sm md:text-base text-pretty text-banner-text opacity-70 p-0 m-0 text-center max-w-xl">
					{__(
						"Share your vision, and we'll craft a website that's perfectly tailored to your needs, ready to launch in no time.",
						'extendify-local',
					)}
				</p>
			</motion.div>
		);
	}

	return (
		<motion.h2 className={headingClass} {...transition}>
			{__('Describe the website you want to build', 'extendify-local')}
		</motion.h2>
	);
};
