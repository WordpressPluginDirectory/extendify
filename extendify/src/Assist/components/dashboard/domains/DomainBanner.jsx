import { Spinner } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, globe, close } from '@wordpress/icons';
import { useDomainsSuggestions } from '@assist/hooks/useDomainsSuggestions';
import { domainSearchUrl, createDomainUrlLink } from '@assist/lib/domains';
import { useGlobalStore } from '@assist/state/globals';

export const DomainBanner = () => {
	const {
		dismissBanner,
		updateDomainsCacheKey,
		domainsCacheKey: cacheKey,
	} = useGlobalStore();
	const { data, isLoading, error } = useDomainsSuggestions({ cacheKey });
	const [searchUrl, setSearchUrl] = useState('');

	useEffect(() => {
		if (!domainSearchUrl || isLoading) return;
		setSearchUrl(createDomainUrlLink(data?.[0]?.toLowerCase() || ''));
	}, [data, isLoading]);

	return (
		<div className="relative py-5 lg:py-6 px-5 lg:px-8 w-full border border-gray-300 text-base bg-white rounded mb-6 min-h-32 h-full">
			<button
				type="button"
				onClick={() => dismissBanner('domain-banner')}
				className="hover:bg-gray-300 cursor-pointer absolute flex justify-center items-center top-0 right-0 text-center bg-gray-100 h-8 w-8 rounded-se rounded-bl">
				<Icon icon={close} size={32} />
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
					{!searchUrl ||
						(!isLoading && error && (
							<div className="flex justify-center items-center h-full">
								{__('Service offline. Check back later.', 'extendify-local')}
							</div>
						))}

					{isLoading && (
						<div className="flex justify-center items-center h-full">
							<Spinner />
						</div>
					)}

					{!isLoading && !error && (
						<>
							<div className="flex flex-wrap items-center mb-4 gap-1">
								<Icon icon={globe} size={24} />
								<span className="font-semibold">{data && data?.[0]}:</span>
								<span className="text-sm">
									{__(
										'Available and just right for your site.',
										'extendify-local',
									)}
								</span>
							</div>
							<a
								href={searchUrl}
								onClick={updateDomainsCacheKey}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center px-4 h-10 cursor-pointer text-sm no-underline bg-design-main text-design-text rounded-sm hover:opacity-90">
								{__('Secure a domain', 'extendify-local')}
							</a>
						</>
					)}
				</div>
			</div>
		</div>
	);
};
