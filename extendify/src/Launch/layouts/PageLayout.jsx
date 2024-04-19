import { PageControl } from '@launch/components/PageControl';
import { Logo } from '@launch/svg';

export const PageLayout = ({ children, includeNav = true }) => {
	return (
		<div className="flex flex-col h-[calc(100dvh)]">
			<div className="flex-none px-6 py-5 md:px-12 md:py-6 w-full bg-banner-main">
				{window.extSharedData?.partnerLogo ? (
					<div className="flex items-center h-10 max-w-52	md:max-w-72 overflow-hidden">
						<img
							className="max-w-full max-h-full object-contain"
							src={window.extSharedData.partnerLogo}
							alt={window.extSharedData?.partnerName ?? ''}
						/>
					</div>
				) : (
					<Logo className="text-banner-text w-auto h-8" />
				)}
			</div>
			{children}
			{includeNav && (
				<div className="flex-none px-6 py-5 md:px-12 md:py-6 w-full bg-white shadow-surface border-t border-gray-100 z-10">
					<PageControl />
				</div>
			)}
		</div>
	);
};
