import { DialogTitle } from '@headlessui/react';
import { __ } from '@wordpress/i18n';
import { check, Icon } from '@wordpress/icons';

const SuccessIcon = () => (
	<>
		<div className="p-2 rounded-full bg-[#4AB866]/25">
			<Icon
				icon={check}
				className="h-10 w-10 rounded-full bg-[#4AB866] fill-white"
			/>
		</div>
	</>
);

export const SetupComplete = ({ handleClose }) => {
	return (
		<div className="px-16 py-10 flex flex-col items-center justify-center">
			<div className="mb-6">
				<SuccessIcon />
			</div>
			<DialogTitle className="text-xl font-semibold text-center text-gray-900 mb-2 font-sans">
				{__('Setup complete', 'extendify-local')}
			</DialogTitle>
			<p className="text-center text-gray-700 mb-2 text-base">
				{__(
					'Your plugin accounts have been set up. Account activation may take a moment to complete.',
					'extendify-local',
				)}
			</p>
			<button
				type="button"
				onClick={handleClose}
				className="mt-6 px-6 py-3 text-base font-medium text-white bg-extendify-main rounded-lg hover:bg-extendify-main-dark focus:outline-none focus:ring-2 focus:ring-extendify-main focus:ring-offset-2"
			>
				{__('Close', 'extendify-local')}
			</button>
		</div>
	);
};
