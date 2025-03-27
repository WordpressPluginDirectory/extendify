import { PATTERNS_HOST, AI_HOST, IMAGES_HOST } from '@constants';
import { getSiteStyle } from '@page-creator/api/WPApi';

const { siteTitle, siteType } = window.extSharedData;
const extraBody = {
	...Object.fromEntries(
		Object.entries(window.extSharedData).filter(([key]) =>
			// Optionally add items to request body
			[
				'partnerId',
				'devbuild',
				'version',
				'siteId',
				'wpLanguage',
				'wpVersion',
				'siteProfile',
			].includes(key),
		),
	),
};

const fetchPageTemplates = async (details = {}) => {
	const { showLocalizedCopy, activePlugins } = window.extSharedData;

	const plugins =
		activePlugins?.map((path) => {
			return path.split('/')[0];
		}) ?? [];

	const data = Object.entries(details).reduce((result, [key, value]) => {
		if (value === null) result;
		return {
			...result,
			[key]: typeof value === 'object' ? JSON.stringify(value) : value,
		};
	}, {});

	const res = await fetch(`${PATTERNS_HOST}/api/page-creator`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...extraBody,
			siteType: siteType?.slug,
			plugins: JSON.stringify(plugins),
			showLocalizedCopy: !!showLocalizedCopy,
			allowedPlugins: JSON.stringify(plugins),
			...data,
		}),
	});

	if (!res.ok) throw new Error('Bad response from server');

	return await res.json();
};

export const getGeneratedPageTemplate = async ({ pageProfile, siteImages }) => {
	const siteStyle = await getSiteStyle();

	// we need the new generated AI description from the page profile
	const page = await fetchPageTemplates({
		siteInformation: { title: siteTitle },
		siteImages,
		siteStyle,
		pageProfile,
	});

	if (!page?.template) {
		throw new Error('Could not get page');
	}

	return page;
};

export const generateCustomContent = async ({
	page,
	userState,
	pageProfile,
}) => {
	const res = await fetch(`${AI_HOST}/api/patterns`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...extraBody,
			page,
			userState,
			siteProfile: pageProfile,
		}),
	});

	if (!res.ok) throw new Error('Bad response from server');
	return await res.json();
};

export const getPageProfile = async ({ description, siteProfile }) => {
	const response = await fetch(`${AI_HOST}/api/page-profile`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...extraBody,
			siteDescription: siteProfile?.aiDescription || '',
			description,
		}),
	});

	if (!response.ok) {
		throw new Error('Something went wrong while fetching the profile');
	}

	const data = await response.json();
	return data?.aiDescription
		? data
		: {
				aiTitle: null,
				aiPageType: null,
				aiDescription: null,
				aiKeywords: [],
			};
};

export const getPageImages = async ({ pageProfile }) => {
	const { aiSiteType, aiSiteCategory, aiDescription, aiKeywords } = pageProfile;
	const search = new URLSearchParams({
		aiSiteType,
		aiSiteCategory,
		aiDescription,
		aiKeywords,
		...extraBody,
	});

	if (siteTitle) search.append('title', siteTitle);

	const response = await fetch(`${IMAGES_HOST}/api/search?${search}`, {
		method: 'GET',
		headers: { 'Content-Type': 'application/json' },
	});

	if (!response.ok) {
		throw new Error('Something went wrong while fetching the images');
	}

	const data = await response.json();
	return data?.siteImages ? data : { siteImages: [] };
};
