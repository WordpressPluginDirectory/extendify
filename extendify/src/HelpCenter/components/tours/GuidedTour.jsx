import { Button, Spinner } from '@wordpress/components';
import {
	useRef,
	useCallback,
	useEffect,
	useLayoutEffect,
	useState,
	useMemo,
} from '@wordpress/element';
import { sprintf, __ } from '@wordpress/i18n';
import { Icon, close } from '@wordpress/icons';
import { Dialog } from '@headlessui/react';
import classNames from 'classnames';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalSyncStore } from '@help-center/state/globals-sync';
import { useTourStore } from '@help-center/state/tours';
import tours from '@help-center/tours/tours';
import availableTours from '@help-center/tours/tours.js';

const getBoundingClientRect = (element) => {
	const { top, right, bottom, left, width, height, x, y } =
		element.getBoundingClientRect();
	return { top, right, bottom, left, width, height, x, y };
};

export const GuidedTour = () => {
	const tourBoxRef = useRef();
	const {
		currentTour,
		currentStep,
		startTour,
		closeCurrentTour,
		getStepData,
		onTourPage,
	} = useTourStore();
	const { settings } = currentTour || {};
	const { image, title, text, attachTo, events, options } =
		getStepData(currentStep);

	const { queueTourForRedirect, queuedTour, clearQueuedTour } =
		useGlobalSyncStore();
	const { element, frame, offset, position, hook, boxPadding } = attachTo || {};

	const elementSelector = useMemo(
		() => (typeof element === 'function' ? element() : element),
		[element],
	);

	const frameSelector = useMemo(
		() => (typeof frame === 'function' ? frame() : frame),
		[frame],
	);

	const offsetNormalized = useMemo(
		() => (typeof offset === 'function' ? offset() : offset),
		[offset],
	);
	const hookNormalized = useMemo(
		() => (typeof hook === 'function' ? hook() : hook),
		[hook],
	);

	const initialFocus = useRef();
	const finishedStepOne = useRef(false);
	const [targetedElement, setTargetedElement] = useState(null);
	const [redirecting, setRedirecting] = useState(false);
	const [visible, setVisible] = useState(false);
	const [overlayRect, setOverlayRect] = useState(null);
	const [placement, setPlacement] = useState({
		x: undefined,
		y: undefined,
		...offsetNormalized,
	});
	const setTourBox = useCallback(
		(x, y) => {
			// x is 20 on mobile, so exclude the offset here
			setPlacement(x === 20 ? { x, y } : { x, y, ...offsetNormalized });
		},
		[offsetNormalized],
	);
	const getOffset = useCallback(() => {
		const hooks = hookNormalized?.split(' ') || [];
		return {
			x: hooks.includes('right') ? tourBoxRef.current?.offsetWidth : 0,
			y: hooks.includes('bottom') ? tourBoxRef.current?.offsetHeight : 0,
		};
	}, [hookNormalized]);

	const startOrRecalc = useCallback(() => {
		if (!targetedElement) return;

		const frame = frameSelector
			? document.querySelector(frameSelector)?.contentDocument ?? document
			: document;

		const rect = getBoundingClientRect(
			frame.querySelector(elementSelector) ?? targetedElement,
		);

		// Adjust the frame position if we're in an iframe
		if (frame !== document) {
			const frameRect = getBoundingClientRect(frame.defaultView.frameElement);
			rect.x += frameRect.x;
			rect.left += frameRect.x;
			rect.right += frameRect.x;
			rect.y += frameRect.y;
			rect.top += frameRect.y;
			rect.bottom += frameRect.y;
		}

		if (window.innerWidth <= 960) {
			closeCurrentTour('closed-resize');
			return;
		}
		if (position?.x === undefined) {
			setTourBox(undefined, undefined);
			setOverlayRect(null);
			setVisible(false);
			return;
		}
		const x = Math.max(20, rect?.[position.x] - getOffset().x);
		const y = Math.max(20, rect?.[position.y] - getOffset().y);
		const box = tourBoxRef.current;
		// make sure it doesn't go off-screen
		setTourBox(
			Math.min(x, window.innerWidth - (box?.offsetWidth ?? 0) - 20),
			Math.min(y, window.innerHeight - (box?.offsetHeight ?? 0) - 20),
		);
		setOverlayRect(rect);
	}, [
		targetedElement,
		position,
		getOffset,
		setTourBox,
		frameSelector,
		elementSelector,
		closeCurrentTour,
	]);

	// Pre-launch check whether to redirect
	useLayoutEffect(() => {
		// if the tour has a start from url, redirect there
		if (!settings?.startFrom) return;
		if (onTourPage()) return;
		setRedirecting(true);
		queueTourForRedirect(currentTour.id);
		closeCurrentTour('redirected');
		window.location.assign(settings?.startFrom[0]);
		if (
			window.location.href.split('#')[0] === settings.startFrom[0].split('#')[0]
		) {
			// Reload if hash is the only difference
			window.location.reload();
		}
	}, [
		settings?.startFrom,
		currentTour,
		queueTourForRedirect,
		closeCurrentTour,
		onTourPage,
	]);

	// register a custom event to start the specified tour.
	useEffect(() => {
		const handle = (event) => {
			const { tourSlug } = event.detail;
			if (!tours[tourSlug]) return;

			requestAnimationFrame(() => {
				window.dispatchEvent(new CustomEvent('extendify-hc:minimize'));
				startTour(tours[tourSlug]);
			});
		};
		window.addEventListener('extendify-assist:start-tour', handle);
		return () => {
			window.removeEventListener('extendify-assist:start-tour', handle);
		};
	}, [startTour]);

	// Possibly start the tour, or wait for the load event
	useLayoutEffect(() => {
		if (redirecting) return;
		const tour = queuedTour;
		let rafId = 0;
		if (!tour || !availableTours[tour]) return clearQueuedTour();
		const handle = () => {
			requestAnimationFrame(() => {
				startTour(availableTours[tour]);
			});
			clearQueuedTour();
		};

		addEventListener('load', handle);
		if (document.readyState === 'complete') {
			// Page is already loaded, so we can start the tour immediately
			rafId = requestAnimationFrame(handle);
		}
		return () => {
			cancelAnimationFrame(rafId);
			removeEventListener('load', handle);
		};
	}, [startTour, queuedTour, clearQueuedTour, redirecting]);

	useEffect(() => {
		if (!elementSelector) return;
		// Find and set the element we are attaching to
		const frame = frameSelector
			? document.querySelector(frameSelector)?.contentDocument ?? document
			: document;
		const element =
			frame.querySelector(elementSelector) ??
			document.querySelector(elementSelector);
		if (!element) return;

		setTargetedElement(element);
		return () => setTargetedElement(null);
	}, [frameSelector, elementSelector]);

	// Start building the tour step
	useLayoutEffect(() => {
		if (!targetedElement || redirecting) return;
		setVisible(true);
		startOrRecalc();
		addEventListener('resize', startOrRecalc);
		if (!options?.allowPointerEvents) {
			targetedElement.style.pointerEvents = 'none';
		}
		return () => {
			removeEventListener('resize', startOrRecalc);
			targetedElement.style.pointerEvents = 'auto';
		};
	}, [redirecting, targetedElement, startOrRecalc, options]);

	useEffect(() => {
		if (finishedStepOne.current) return;
		if (!currentStep) return;
		finishedStepOne.current = true;
	}, [currentStep]);
	// Handle the attach and detach events
	useEffect(() => {
		if (currentStep === undefined || !targetedElement) return;
		events?.onAttach?.(targetedElement);
		let inner = 0;
		const id = requestAnimationFrame(() => {
			targetedElement.scrollIntoView({ block: 'start' });
			startOrRecalc();
			inner = requestAnimationFrame(startOrRecalc);
		});
		initialFocus?.current?.focus();
		return () => {
			events?.onDetach?.(targetedElement);
			cancelAnimationFrame(id);
			cancelAnimationFrame(inner);
		};
	}, [currentStep, events, targetedElement, startOrRecalc, initialFocus]);

	useLayoutEffect(() => {
		if (!settings?.allowOverflow) return;
		document.documentElement.classList.add('ext-force-overflow-auto');
		return () => {
			document.documentElement.classList.remove('ext-force-overflow-auto');
		};
	}, [settings]);

	if (!visible) return null;

	const rectWithPadding = addPaddingToRect(overlayRect, boxPadding);
	return (
		<>
			<AnimatePresence>
				{Boolean(currentTour) && (
					<Dialog
						as={motion.div}
						static
						initialFocus={initialFocus}
						className="extendify-help-center"
						open={Boolean(currentTour)}
						onClose={() => undefined}>
						<div className="relative z-max">
							<motion.div
								ref={tourBoxRef}
								animate={{ opacity: 1, ...placement }}
								initial={{ opacity: 0, ...placement }}
								// TODO: fire another event after animation completes?
								onAnimationComplete={() => {
									startOrRecalc();
								}}
								transition={{
									duration: finishedStepOne.current ? 0.5 : 0,
									ease: 'easeInOut',
								}}
								className="fixed top-0 left-0 shadow-2xl sm:overflow-hidden bg-transparent flex flex-col max-w-xs z-20"
								style={{
									minWidth: settings?.minBoxWidth ?? '325px',
								}}>
								<button
									data-test="close-tour"
									className="absolute bg-white cursor-pointer flex ring-gray-200 ring-1 focus:ring-wp focus:ring-design-main focus:shadow-none h-6 items-center justify-center leading-none m-2 outline-none p-0 right-0 rounded-full top-0 w-6 border-0 z-20"
									onClick={() => closeCurrentTour('closed-manually')}
									aria-label={__('Close Modal', 'extendify-local')}>
									<Icon icon={close} className="w-4 h-4 fill-current" />
								</button>
								<Dialog.Title className="sr-only">
									{currentTour?.title ?? __('Tour', 'extendify-local')}
								</Dialog.Title>
								{image && (
									<div
										className="w-full p-6"
										style={{
											minHeight: 150,
											background:
												'linear-gradient(58.72deg, #485563 7.71%, #29323C 92.87%)',
										}}>
										<img src={image} className="w-full block" alt={title} />
									</div>
								)}
								<div className="m-0 p-6 pt-0 text-left relative bg-white">
									{title && (
										<h2 className="text-xl font-medium mb-2">{title}</h2>
									)}
									{text && <p className="mb-6">{text}</p>}
									<BottomNav initialFocus={initialFocus} />
								</div>
							</motion.div>
						</div>
					</Dialog>
				)}
			</AnimatePresence>
			{options?.allowPointerEvents || (
				<div aria-hidden={true} className="fixed inset-0 z-max-1" />
			)}
			<AnimatePresence>
				{Boolean(currentTour) && overlayRect?.left !== undefined && (
					<>
						<motion.div
							initial={{
								opacity: 0,
								clipPath:
									'polygon(0px 0px, 100% 0px, 100% 100%, 0px 100%, 0 0)',
							}}
							animate={{
								opacity: 1,
								clipPath: `polygon(0px 0px, 100% 0px, 100% 100%, 0px 100%, 0 0, ${rectWithPadding.left}px 0, ${rectWithPadding.left}px ${rectWithPadding?.bottom}px, ${rectWithPadding?.right}px ${rectWithPadding.bottom}px, ${rectWithPadding.right}px ${rectWithPadding.top}px, ${rectWithPadding.left}px ${rectWithPadding.top}px)`,
							}}
							transition={{
								duration: finishedStepOne.current ? 0.5 : 0,
								ease: 'easeInOut',
							}}
							className="hidden lg:block fixed inset-0 bg-black/70 z-max-1"
							aria-hidden="true"
						/>
						<BorderOutline
							rectWithPadding={rectWithPadding}
							finishedStepOne={finishedStepOne}
						/>
					</>
				)}
			</AnimatePresence>
		</>
	);
};

const BorderOutline = ({ rectWithPadding, finishedStepOne }) => {
	const [visible, setVisible] = useState(false);
	return (
		<motion.div
			initial={{ ...(rectWithPadding ?? {}) }}
			animate={{ ...(rectWithPadding ?? {}) }}
			transition={{
				duration: finishedStepOne.current ? 0.5 : 0,
				ease: 'easeInOut',
			}}
			onAnimationStart={() => setVisible(false)}
			onAnimationComplete={() => setVisible(true)}
			className={classNames('hidden lg:block fixed inset-0 border-2  z-high', {
				'border-transparent': !visible,
				'border-design-main': visible,
			})}
			aria-hidden="true"
		/>
	);
};

const BottomNav = ({ initialFocus }) => {
	const {
		goToStep,
		completeCurrentTour,
		currentStep,
		preparingStep,
		getStepData,
		hasNextStep,
		nextStep,
		hasPreviousStep,
		prevStep,
		currentTour,
	} = useTourStore();
	const { options = {} } = getStepData(currentStep);
	const { hideBackButton = false } = options;
	const { steps, settings } = currentTour || {};

	return (
		<div
			id="extendify-tour-navigation"
			className="flex justify-between items-center w-full">
			<div className="flex-1 flex justify-start">
				<AnimatePresence>
					{hasPreviousStep() && !hideBackButton && (
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
							<button
								className="flex gap-2 p-0 h-8 rounded-sm items-center justify-center bg-transparent hover:bg-transparent focus:outline-none ring-design-main focus:ring-wp focus:ring-offset-1 focus:ring-offset-white text-gray-900 disabled:opacity-60"
								onClick={prevStep}
								disabled={preparingStep > -1}>
								{preparingStep < currentStep && (
									<Spinner className="text-design-main m-0 h-4" />
								)}
								<span>{__('Back', 'extendify-local')}</span>
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{steps?.length > 2 && !settings?.hideDotsNav ? (
				<nav
					role="navigation"
					aria-label={__('Tour Steps', 'extendify-local')}
					className="flex-1 flex items-center justify-center gap-1 -translate-x-3">
					{steps.map((_step, index) => (
						<div key={index}>
							<button
								aria-label={sprintf(
									// translators: %1$s is the current step, %2$s is the total number of steps
									__('%1$s of %2$s', 'extendify-local'),
									index + 1,
									steps.length,
								)}
								aria-current={index === currentStep}
								className={`focus:ring-wp focus:outline-none ring-offset-1 ring-offset-white focus:ring-design-main block cursor-pointer w-2.5 h-2.5 m-0 p-0 rounded-full ${
									index === currentStep ? 'bg-design-main' : 'bg-gray-300'
								}`}
								onClick={() => goToStep(index)}
								disabled={preparingStep > -1}
							/>
						</div>
					))}
				</nav>
			) : null}

			<div className="flex-1 flex justify-end">
				{hasNextStep() ? (
					<Button
						ref={initialFocus}
						id="help-center-tour-next-button"
						data-test="help-center-tour-next-button"
						onClick={nextStep}
						disabled={preparingStep > -1}
						className="flex gap-2 text-design-text bg-design-main focus:text-design-text disabled:opacity-60"
						variant="primary">
						{preparingStep > currentStep && (
							<Spinner className="text-design-main m-0 h-4" />
						)}
						<span>{__('Next', 'extendify-local')}</span>
					</Button>
				) : (
					<Button
						id="help-center-tour-next-button"
						data-test="help-center-tour-next-button"
						onClick={() => {
							completeCurrentTour();
						}}
						className="bg-design-main"
						variant="primary">
						{__('Done', 'extendify-local')}
					</Button>
				)}
			</div>
		</div>
	);
};

const addPaddingToRect = (rect, padding) => ({
	top: rect.top - (padding?.top ?? 0),
	left: rect.left - (padding?.left ?? 0),
	right: rect.right + (padding?.right ?? 0),
	bottom: rect.bottom + (padding?.bottom ?? 0),
	width: rect.width + (padding?.left ?? 0) + (padding?.right ?? 0),
	height: rect.height + (padding?.top ?? 0) + (padding?.bottom ?? 0),
	x: rect.x - (padding?.left ?? 0),
	y: rect.y - (padding?.top ?? 0),
});
