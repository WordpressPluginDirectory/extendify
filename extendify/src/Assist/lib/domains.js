const blockList = ['instawp.xyz', 'my blog'];
const hasValidSiteName = (title) =>
	blockList.every((l) => !title.toLowerCase().includes(l));

// This function is used to decode the html entities in the name of the site,
// like an apostrophe in the name, it will return encoded.
const decode = (input) => {
	const doc = new DOMParser().parseFromString(input, 'text/html');
	return doc.documentElement.textContent;
};

let { devbuild, siteTitle } = window.extSharedData;

const { showBanner, showTask, tlds, searchUrl } =
	window.extAssistData?.domainsSuggestionSettings || {};

export const domainSearchUrl =
	devbuild && !searchUrl
		? 'https://extendify.com?s={DOMAIN}'
		: searchUrl.replaceAll('&amp;', '&');

export const showDomainBanner =
	devbuild || (showBanner && siteTitle && hasValidSiteName(siteTitle));

export const showDomainTask =
	devbuild || (showTask && siteTitle && hasValidSiteName(siteTitle));

export const tldList = tlds.replaceAll('.', '').trim() || 'com,net';

siteTitle = decode(siteTitle).replaceAll(/[^a-zA-Z\s0-9]/gi, '');
export { siteTitle };

/**
 * 	The domainSearchUrl will look something like
 * 	https://example.com?s={DOMAIN} where {DOMAIN} will be replaced with the domain name
 */
export const createDomainUrlLink = (domain) =>
	domainSearchUrl.replace('{DOMAIN}', domain);
