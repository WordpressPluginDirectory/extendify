import { __ } from '@wordpress/i18n';
import { Icon, globe, close } from '@wordpress/icons';
import {
	domainSearchUrl,
	createDomainUrlLink,
	deleteDomainCache,
} from '@assist/lib/domains';
import { safeParseJson } from '@assist/lib/parsing';
import { useGlobalStore } from '@assist/state/globals';

const domains = safeParseJson(window.extSharedData.resourceData)?.domains || [];

export const DomainBanner = () => {
	const { dismissBanner } = useGlobalStore();

	if (!domainSearchUrl || !domains?.length) return null;

	return (
		<div
			className="relative py-5 lg:py-6 px-5 lg:px-8 w-full border border-gray-300 text-base bg-white rounded mb-6 min-h-32 h-full"
			data-test="assist-domain-banner-main-domain-module">
			<button
				type="button"
				onClick={() => dismissBanner('domain-banner')}
				className="hover:bg-gray-300 cursor-pointer absolute flex justify-center items-center top-0 right-0 text-center bg-gray-100 h-8 w-8 rounded-se rounded-bl">
				<Icon icon={close} size={32} className="fill-current" />
			</button>
			<div className="grid md:grid-cols-2 gap-4 md:gap-12">
				<div className="domain-name-message">
					<div className="text-lg font-semibold">
						{__('Your Own Domain Awaits', 'extendify-local')}
					</div>
					<div className="text-sm mt-1">
						{__(
							'Move from a subdomain to a custom domain for improved website identity and SEO benefits.',
							'extendify-local',
						)}
					</div>
				</div>
				<div className="domain-name-action">
					{!domains?.length > 0 && (
						<div className="flex justify-center items-center h-full">
							{__('Service offline. Check back later.', 'extendify-local')}
						</div>
					)}

					{domains?.length > 0 ? (
						<>
							<div className="mb-4 gap-1 flex flex-col">
								<div className="font-semibold flex items-center gap-1">
									<Icon icon={globe} size={24} className="fill-current" />
									{domains[0]}
								</div>
								<p className="text-sm m-0 p-0">
									{__(
										// translators: this refers to a domain name
										'Available and just right for your site',
										'extendify-local',
									)}
								</p>
							</div>

							<a
								href={createDomainUrlLink(domainSearchUrl, domains[0])}
								onClick={deleteDomainCache}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center px-4 h-10 cursor-pointer text-sm no-underline bg-design-main text-design-text rounded-sm hover:opacity-90">
								{__('Secure a domain', 'extendify-local')}
							</a>
						</>
					) : null}
				</div>
			</div>
		</div>
	);
};
