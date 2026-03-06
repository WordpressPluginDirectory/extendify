import { extendify } from '@auto-launch/icons';
import { Icon } from '@wordpress/icons';

export const Logo = () => {
	if (window.extSharedData?.partnerLogo) {
		return (
			<div className="flex h-10 max-w-52 items-center overflow-hidden md:max-w-72">
				<img
					className="max-h-full max-w-full object-contain"
					src={window.extSharedData.partnerLogo}
					alt={window.extSharedData?.partnerName ?? ''}
				/>
			</div>
		);
	}
	return (
		<Icon
			width={undefined}
			icon={extendify}
			className="h-8 w-auto text-banner-text"
		/>
	);
};
