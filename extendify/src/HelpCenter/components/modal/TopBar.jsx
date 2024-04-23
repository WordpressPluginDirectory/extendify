import { __ } from '@wordpress/i18n';
import { Icon, closeSmall, chevronLeft, reset } from '@wordpress/icons';
import classNames from 'classnames';
import { useRouter } from '@help-center/hooks/useRouter';
import { useGlobalSyncStore } from '@help-center/state/globals-sync';

const { partnerLogo, partnerName } = window.extSharedData;

export const Topbar = () => {
	const { visibility, setVisibility } = useGlobalSyncStore();
	const { current, history } = useRouter();
	const handleClose = () => setVisibility('closed');
	const isMinimized = visibility === 'minimized';
	const toggleMinimized = () => {
		setVisibility(isMinimized ? 'open' : 'minimized');
	};

	return (
		<div className="relative bg-banner-main flex justify-end items-center p-4 gap-x-2">
			<div
				role={isMinimized ? 'button' : 'heading'}
				onClick={isMinimized ? toggleMinimized : undefined}
				aria-label={
					isMinimized ? __('Show Help Center', 'extendify-local') : undefined
				}
				aria-expanded={isMinimized ? 'false' : 'true'}
				className={classNames('bg-banner-main flex justify-between w-full', {
					'cursor-pointer': isMinimized,
				})}>
				<div
					className={classNames('flex w-full gap-1', {
						'gap-4': history.length === 1,
					})}>
					<LogoOrBackButton />
					{current?.title && (
						<span className="text-banner-text border-banner-text text-base font-medium">
							{current.title}
						</span>
					)}
				</div>
			</div>
			<div className="flex justify-end items-center gap-2.5">
				<button
					className="text-banner-text fill-banner-text border-0 bg-transparent p-0 m-0 cursor-pointer"
					type="button"
					data-test="help-center-toggle-minimize-button"
					onClick={toggleMinimized}>
					{isMinimized ? (
						<>
							<Icon
								className="fill-current rotate-90"
								icon={chevronLeft}
								size={24}
							/>
							<span className="sr-only">
								{__('Show Help Center', 'extendify-local')}
							</span>
						</>
					) : (
						<>
							<Icon className="fill-current" icon={reset} size={24} />
							<span className="sr-only">
								{__('Minimize Help Center', 'extendify-local')}
							</span>
						</>
					)}
				</button>
				<button
					className="text-banner-text fill-banner-text border-0 bg-transparent p-0 m-0 cursor-pointer"
					type="button"
					data-test="help-center-close-button"
					onClick={handleClose}>
					<Icon icon={closeSmall} size={24} />
					<span className="sr-only">{__('close', 'extendify-local')}</span>
				</button>
			</div>
		</div>
	);
};

const LogoOrBackButton = () => {
	const { goBack, history } = useRouter();
	const { visibility } = useGlobalSyncStore();

	if (history.length > 1 && visibility === 'open') {
		return (
			<button
				className="text-banner-text fill-banner-text border-0 bg-transparent p-0 m-0 cursor-pointer"
				type="button"
				onClick={goBack}>
				<Icon icon={chevronLeft} />
				<span className="sr-only">{__('Go back', 'extendify-local')}</span>
			</button>
		);
	}

	return partnerLogo ? (
		<div className="bg-banner-main flex justify-center h-6 after:text-banner-text after:opacity-40 after:relative after:-right-2 after:top-0.5 after:content-['|']">
			<div className="flex h-6 overflow-hidden max-w-[9rem]">
				<img
					className="max-w-full max-h-full object-contain"
					src={partnerLogo}
					alt={partnerName}
				/>
			</div>
		</div>
	) : null;
};
