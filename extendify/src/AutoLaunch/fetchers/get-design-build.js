import { uploadLogo } from '@auto-launch/fetchers/get-logo';
import { getThemeVariation } from '@auto-launch/fetchers/get-variation';
import {
	getDesignBuildShape,
	getLogoShape,
	getPluginsShape,
	getStyleShape,
} from '@auto-launch/fetchers/shape';
import {
	fetchWithTimeout,
	retryTwice,
	setStatus,
} from '@auto-launch/functions/helpers';
import { updateOption } from '@auto-launch/functions/wp';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { AI_HOST } from '@constants';
import { digest } from '@shared/api/digest';
import { __ } from '@wordpress/i18n';
import { mutate } from 'swr';

const fallback = null;
const headers = { 'Content-Type': 'application/json' };

export const handleDesignBuild = async ({ urlParams }) => {
	const buildId = urlParams?.['build-id'];
	if (!buildId) return fallback;

	// translators: this is for a action log UI. Keep it short
	setStatus(__('Loading your design', 'extendify-local'));

	const url = `${AI_HOST}/api/design/${encodeURIComponent(buildId)}`;
	const response = await retryTwice(() =>
		fetchWithTimeout(url, { headers }),
	).catch((error) => {
		return { ok: false, statusText: error.message, status: 0 };
	});

	if (!response?.ok) {
		digest({
			error: {
				message: response.statusText,
				name: 'FetchError',
				status: response.status,
			},
			details: { source: 'auto-launch', caller: 'handleDesignBuild' },
		});
		return fallback;
	}

	try {
		const parsed = getDesignBuildShape.parse(await response.json());

		// Stash the site profile
		const profile = parsed.siteProfile;
		await updateOption('extendify_site_profile', JSON.stringify(profile));
		mutate('siteProfile', { siteProfile: profile }, false);

		// Stash the site style and variation
		const style = parsed.siteStyle;
		const fonts =
			style.fonts?.heading || style.fonts?.body ? style.fonts : null;
		const variation = await getThemeVariation(
			{ slug: style.colorPalette, fonts },
			{ fallback: true },
		);
		const siteStyle = { ...style, variation };
		await updateOption('extendify_site_style', siteStyle);
		await updateOption('extendify_animation_settings', {
			type: style.animation ?? 'fade',
			speed: 'medium',
		});
		mutate('siteStyle', getStyleShape.parse({ siteStyle }), false);

		// Stash the plugins
		const sitePlugins = parsed.selectedPlugins;
		mutate('sitePlugins', getPluginsShape.parse({ sitePlugins }), false);

		// Stash the logo
		await uploadLogo(parsed.logoUrl);
		mutate('siteLogo', getLogoShape.parse({ logoUrl: parsed.logoUrl }), false);

		const designBuild = { buildId, ...parsed, siteProfile: profile, siteStyle };
		// Spreading it here sets it for other state values we override
		return { designBuild, ...designBuild };
	} catch (e) {
		digest({
			error: e,
			details: { source: 'auto-launch', caller: 'handleDesignBuild::parsing' },
		});
		console.error('handleDesignBuild:', e);
		// Drop the build-id so downstream checks (e.g. skipDescription) fallback
		useLaunchDataStore.setState((s) => ({
			urlParams: { ...s.urlParams, 'build-id': '' },
		}));
		return fallback;
	}
};

// Prepend the design build hero; flagged so it skips content regeneration.
export const applyDesignBuildHero = (patterns, designBuild) => {
	if (!designBuild?.patternCode) return patterns;
	return [
		{
			name: designBuild.patternId,
			code: designBuild.patternCode,
			patternTypes: ['hero-header'],
			contentGenerated: true,
		},
		...patterns,
	];
};

// Reorder pages to match the design build's page order; extras fall to the end.
export const applyDesignBuildOrder = (pages, designBuild) => {
	const order = designBuild?.pages?.map((p) => p.slug) ?? [];
	if (!order.length) return pages;
	return [
		...order.map((slug) => pages.find((t) => t.slug === slug)).filter(Boolean),
		...pages.filter((t) => !order.includes(t.slug)),
	];
};

// Tag non-hero patterns with their aligned design build page slug/name.
// For single-page sites mainly
export const applyDesignBuildNav = (patterns, designBuild) => {
	const pages = designBuild?.pages ?? [];
	if (!pages.length) return patterns;
	let i = 0;
	return patterns.map((pattern) => {
		if (pattern.patternTypes?.includes('hero-header')) return pattern;
		const page = pages[i++];
		if (!page) return pattern;
		return { ...pattern, navSlug: page.slug, navLabel: page.name };
	});
};
