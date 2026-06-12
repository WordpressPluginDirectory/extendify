import { Description, DialogTitle } from '@headlessui/react';
import { Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export const Loading = () => {
	return (
		<div className="py-10 px-16 flex flex-col items-center justify-center">
			<div className="mb-6">
				<Spinner className="h-10 w-10 text-[#1A5130]" />
			</div>
			<DialogTitle className="text-xl font-semibold text-center text-gray-900 mb-3 font-sans">
				{__('Setting up plugins for you...', 'extendify-local')}
			</DialogTitle>
			<Description className="text-center text-gray-700 text-base">
				{__(
					'Please wait while we install your plugins and create accounts with the selected providers. This should only take a moment.',
					'extendify-local',
				)}
			</Description>
		</div>
	);
};
