import { __ } from '@wordpress/i18n';
import classNames from 'classnames';

export const AcceptTerms = ({
	setAcceptTerms,
	acceptTerms,
	consentTermsHTML,
}) => {
	return (
		<div className="flex flex-col">
			<p
				className="p-0 m-0 mb-2 text-base"
				dangerouslySetInnerHTML={{ __html: consentTermsHTML }}
			/>
			<label
				htmlFor="accept-terms"
				className="text-base ml-1 flex items-center focus-within:text-design-mains after:content-['*'] after:ml-0.5 after:text-red-500">
				<span className="relative">
					<input
						id="accept-terms"
						className="h-4 w-4 rounded-sm focus:ring-0 focus:ring-offset-0"
						type="checkbox"
						onChange={() => setAcceptTerms(!acceptTerms)}
						checked={acceptTerms}
					/>
					<svg
						className={classNames('absolute block inset-0 h-6 w-5', {
							'text-white': acceptTerms,
							'text-transparent': !acceptTerms,
						})}
						viewBox="1 0 20 20"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						role="presentation">
						<path
							d="M8.72912 13.7449L5.77536 10.7911L4.76953 11.7899L8.72912 15.7495L17.2291 7.24948L16.2304 6.25073L8.72912 13.7449Z"
							fill="currentColor"
						/>
					</svg>
				</span>
				<span className="ml-1 text-base">
					{__('I agree to the AI terms and conditions', 'extendify-local')}
				</span>
			</label>
		</div>
	);
};
