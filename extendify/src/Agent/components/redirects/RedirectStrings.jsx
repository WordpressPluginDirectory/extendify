import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const path = '/wp/v2/pages?orderby=modified&order=desc&per_page=1';
export const RedirectStrings = () => {
	const [pageInfo, setPageInfo] = useState(null);

	useEffect(() => {
		apiFetch({ path }).then((pages) => {
			if (pages.length === 0) return;
			setPageInfo(pages[0]);
		});
	}, []);

	return (
		<div className="mb-4 ml-10 mr-2 flex flex-col rounded-lg border border-gray-300 bg-gray-50 rtl:ml-2 rtl:mr-10">
			<div className="rounded-lg border-b border-gray-300 bg-white p-3">
				<p className="m-0 p-0 text-sm text-gray-900">
					{__(
						'Hey there! It looks like you are trying to edit the strings of a post, but you are not on a page we can edit.',
						'extendify-local',
					)}
				</p>
			</div>
			{pageInfo && (
				<div className="m-0 p-3 text-sm text-gray-900">
					{/* {__('Suggestion:', 'extendify-local')}{' '}
					<a href={pageInfo.link}>{pageInfo.title.rendered}</a> */}
				</div>
			)}
		</div>
	);
};
