import { useState, useLayoutEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import classNames from 'classnames';
import { colord } from 'colord';
import { Logo } from '@assist/svg';

export const Header = () => {
	const [contrastBg, setContrastBg] = useState();
	const [focusColor, setFocusColor] = useState();

	useLayoutEffect(() => {
		const documentStyles = window.getComputedStyle(document.body);
		const bannerMain = documentStyles.getPropertyValue('--ext-banner-main');
		const b = colord(bannerMain || '#000000');
		const contrast = b.isDark() ? b.lighten(0.1) : b.darken(0.1);
		setContrastBg(contrast.toHex());
		const focus = b.isDark() ? b.lighten(0.3) : b.darken(0.3);
		setFocusColor(focus.toHex());
	}, []);

	return (
		<header className="w-full flex bg-banner-main border-b border-gray-400">
			<div className="max-w-[996px] w-full mx-auto mt-auto flex flex-col px-4">
				<div className="flex flex-wrap justify-between items-center my-6 gap-x-4 gap-y-6">
					{window.extSharedData?.partnerLogo && (
						<div className="flex h-10 max-w-52 md:max-w-72 overflow-hidden">
							<img
								className="max-w-full max-h-full object-contain"
								src={window.extSharedData.partnerLogo}
								alt={window.extSharedData.partnerName}
							/>
						</div>
					)}
					{!window.extSharedData?.partnerLogo && (
						<Logo className="logo text-banner-text max-h-9 w-32 sm:w-40" />
					)}
					<div
						id="assist-menu-bar"
						className={classNames(
							'lg:flex lg:w-auto flex-wrap gap-4 items-center',
						)}>
						<a
							style={{
								borderColor: contrastBg,
								'--tw-ring-color': focusColor,
								'--ext-override': focusColor,
							}}
							className="text-sm text-center bg-white text-gray-900 border-gray-500 border cursor-pointer rounded-sm lg:rounded-sm py-2 px-4 no-underline block lg:inline-block hover:bg-gray-100 focus:ring focus:ring-offset-1 focus:ring-gray-900 focus:outline-none transition-colors duration-200"
							href={window.extSharedData.home}
							target="_blank"
							rel="noreferrer">
							{__('View site', 'extendify-local')}
						</a>
					</div>
				</div>
			</div>
		</header>
	);
};
