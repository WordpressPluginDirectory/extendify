import { __ } from '@wordpress/i18n';

export const NeedsTheme = () => {
	return (
		<div className="flex w-full flex-col max-w-5xl p-6 lg:p-10">
			<h2 className="text-lg text-center text-gray-900 font-semibold px-4 py-0 m-0">
				{__('One more thing before we start.', 'extendify-local')}
			</h2>
			<div className="relative mx-auto w-full max-w-xl text-gray-900">
				<p className="text-base">
					{__(
						'Hey there, Launch is powered by Extendable and is required to proceed. You can install it from the link below and start over once activated.',
						'extendify-local',
					)}
				</p>
				<a
					className="mt-4 text-base font-medium text-design-main underline"
					href={`${window.extSharedData.adminUrl}theme-install.php?theme=extendable`}
				>
					{__('Take me there', 'extendify-local')}
				</a>
			</div>
		</div>
	);
};
