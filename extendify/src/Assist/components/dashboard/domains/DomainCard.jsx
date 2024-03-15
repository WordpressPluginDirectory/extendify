import { Spinner } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, chevronRightSmall } from '@wordpress/icons';
import { useDomainsSuggestions } from '@assist/hooks/useDomainsSuggestions';
import { domainSearchUrl, createDomainUrlLink } from '@assist/lib/domains';
import { useGlobalStore } from '@assist/state/globals';
import { useTasksStore } from '@assist/state/tasks';

export const DomainCard = ({ task }) => {
	const { updateDomainsCacheKey, domainsCacheKey: cacheKey } = useGlobalStore();
	const { data, isLoading, error } = useDomainsSuggestions({ cacheKey });
	const mainDomain = data?.[0];
	const { completeTask } = useTasksStore();
	const [searchUrl, setSearchUrl] = useState('');

	useEffect(() => {
		if (!domainSearchUrl || isLoading) return;
		setSearchUrl(createDomainUrlLink(mainDomain?.toLowerCase() || ''));
	}, [data, isLoading, mainDomain]);

	const handleInteract = () => {
		completeTask(task.slug);
		updateDomainsCacheKey();
	};

	if (isLoading) {
		return (
			<div
				className="flex w-full h-full items-center justify-center bg-right-bottom bg-no-repeat bg-cover"
				style={{
					backgroundImage: `url(${
						window.extAssistData.asset_path + '/domains-recommendations.png'
					})`,
				}}>
				<Spinner />
			</div>
		);
	}

	if (error || !mainDomain) {
		return (
			<div
				className="flex w-full h-full items-center justify-center bg-right-bottom bg-no-repeat bg-cover"
				style={{
					backgroundImage: `url(${
						window.extAssistData.asset_path + '/domains-recommendations.png'
					})`,
				}}>
				{__('Service offline. Check back later.', 'extendify-local')}
			</div>
		);
	}

	return (
		<div
			className="flex w-full h-full bg-right-bottom bg-no-repeat bg-cover"
			style={{
				backgroundImage: `url(${
					window.extAssistData.asset_path + '/domains-recommendations.png'
				})`,
			}}>
			<div className="w-full px-8 md:pl-8 md:pr-0 py-14 lg:mr-24">
				<div className="title font-semibold	text-2xl md:text-4xl">
					{task.innerTitle}
				</div>
				<div className="description text-base mt-2 mb-8">
					{task.description}
				</div>
				<div className="bg-gray-100 rounded md:w-full overflow">
					<div className="rounded-tr rounded-tl md:flex md:justify-between md:items-center border-b py-4 px-6 border-gray-200 md:flex-wrap">
						<div>
							<div className="text-gray-900 uppercase bg-wp-alert-yellow rounded-full w-fit border-wp-alert-yellow py-1 px-3 mb-1 text-sm bg-opacity-40">
								{__('Recommend', 'extendify-local')}
							</div>
							<div className="text-xl lowercase font-semibold">
								{mainDomain}
							</div>
						</div>
						<a
							href={searchUrl}
							target="_blank"
							rel="noreferrer"
							onClick={handleInteract}
							className="mt-3 md:mt-0 h-8 text-sm bg-design-main text-design-text hover:opacity-90 border-design-main py-2 px-3 inline-flex md:flex justify-between items-center rounded-sm cursor-pointer leading-tight text-center no-underline">
							{__('Register this domain', 'extendify-local')}
							<Icon icon={chevronRightSmall} className="fill-current" />
						</a>
					</div>
					{/*Secondary domains*/}
					{data?.slice(1)?.map((domain) => (
						<a
							href={createDomainUrlLink(domain)}
							target="_blank"
							rel="noreferrer"
							className="text-sm font-normal text-gray-800 lowercase hover:bg-gray-50 h-11 cursor-pointer flex justify-between items-center py-3.5 px-6 border-b border-gray-200 last:border-transparent no-underline"
							onClick={handleInteract}
							key={domain}>
							{domain}
							<Icon icon={chevronRightSmall} />
						</a>
					))}
				</div>
			</div>
		</div>
	);
};
