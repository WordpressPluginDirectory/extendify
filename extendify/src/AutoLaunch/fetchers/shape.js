import { z } from 'zod';

// get-home
const patternShape = z.looseObject({
	name: z.string(),
	code: z.string(),
	patternTypes: z.array(z.string()),
});
export const homeTemplateShape = z.looseObject({
	id: z.string(),
	slug: z.string(),
	headerCode: z.string().optional(),
	footerCode: z.string().optional(),
	patterns: z.array(patternShape),
});
export const getHomeShape = z.looseObject({
	home: homeTemplateShape,
});

// get-images
export const getImagesShape = z.looseObject({
	siteImages: z.array(z.string()),
});

// get-logo
export const getLogoShape = z.looseObject({
	logoUrl: z.url(),
});

// get-pages
export const pageTemplateShape = z.looseObject({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	patterns: z.array(patternShape),
	siteStyle: z.object(),
});
export const getPagesShape = z.looseObject({
	pages: z.array(pageTemplateShape),
});

// get-plugins
export const pluginShape = z.looseObject({
	name: z.string(),
	wordpressSlug: z.string(),
});
export const getPluginsShape = z.object({
	sitePlugins: z.array(pluginShape),
});

// get-profile
export const getProfileShape = z.looseObject({
	type: z.string(),
	title: z.string(),
	description: z.string(),
	descriptionRaw: z.string().optional(),
	objective: z.string(),
	category: z.string().optional(),
	structure: z.string(),
	imageSearchTerms: z.array(z.string()),
	tone: z.array(z.string()),
	logoObjectName: z.string(),
	products: z.union([z.string(), z.literal(false)]),
	appointments: z.boolean(),
	events: z.boolean(),
	donations: z.boolean(),
	multilingual: z.boolean(),
	contact: z.boolean(),
	address: z.union([z.boolean(), z.string()]),
	blog: z.boolean(),
	landingPage: z.boolean(),
	landingPageCTALink: z.union([z.literal(false), z.string()]),
});

// get-strings
export const getStringsShape = z.looseObject({
	aiHeaders: z.array(z.string()),
	aiBlogTitles: z.array(z.string()),
});

// get-style
export const styleShape = z.looseObject({
	vibe: z.string(),
	fonts: z.looseObject(),
	variation: z.looseObject(),
	colorPalette: z.string(),
	animation: z.string(),
});
export const getStyleShape = z.object({
	siteStyle: styleShape.extend({ variation: z.looseObject().optional() }),
});
