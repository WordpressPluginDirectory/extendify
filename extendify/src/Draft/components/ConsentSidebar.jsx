import { __ } from '@wordpress/i18n';
import { updateUserMeta } from '@draft/api/WPApi';

export const ConsentSidebar = ({ setUserGaveConsent }) => {
	const { consentTermsUrl } = window.extDraftData;

	const userAcceptsTerms = async () => {
		setUserGaveConsent(true);
		window.extDraftData.userGaveConsent = '1';
		await updateUserMeta('ai_consent', true);
	};

	return (
		<>
			<div className="p-6">
				<h2 className="mb-2 mt-0 text-lg">
					{__('Terms of Use', 'extendify-local')}
				</h2>
				<p className="m-0">
					{
						// translators: at the end of the sentence, there is a link to the terms of use
						__(
							'In order to use the AI-powered content drafting tool, you must agree to the terms of use. For more information, click on this link:',
							'extendify-local',
						)
					}{' '}
					<a href={consentTermsUrl} target="_blank" rel="noreferrer">
						{__('Terms of Use', 'extendify-local')}
					</a>
				</p>
				<button
					className="bg-wp-theme-main mt-4 w-full cursor-pointer rounded border-0 px-4 py-2 text-center text-white"
					type="button"
					onClick={() => userAcceptsTerms()}>
					{__('Accept', 'extendify-local')}
				</button>
			</div>
		</>
	);
};
