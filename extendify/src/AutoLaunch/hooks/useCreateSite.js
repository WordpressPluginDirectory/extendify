import { handleHome } from '@auto-launch/fetchers/get-home';
import { handleSiteImages } from '@auto-launch/fetchers/get-images';
import { handleSiteLogo } from '@auto-launch/fetchers/get-logo';
import { handlePages } from '@auto-launch/fetchers/get-pages';
import { handleSitePlugins } from '@auto-launch/fetchers/get-plugins';
import { handleSiteProfile } from '@auto-launch/fetchers/get-profile';
import { handleSiteStrings } from '@auto-launch/fetchers/get-strings';
import { handleSiteStyle } from '@auto-launch/fetchers/get-style';
import {
	installFontFamilies,
	mergeFontsIntoVariation,
} from '@auto-launch/functions/fonts';
import { apiFetchWithTimeout } from '@auto-launch/functions/helpers';
import { checkIn } from '@auto-launch/functions/insights';
import {
	updateButtonLinks,
	updateSinglePageLinksToSections,
} from '@auto-launch/functions/links';
import {
	addPageLinksToNav,
	addSectionLinksToNav,
	createNavigation,
	updateNavAttributes,
} from '@auto-launch/functions/nav';
import {
	addImprintPage,
	createWpPages,
	getPagesToCreate,
	setHelloWorldFeaturedImage,
	updatePageTitlePattern,
} from '@auto-launch/functions/pages';
import { generatePageContent } from '@auto-launch/functions/patterns';
import {
	alreadyActive,
	getActivePlugins,
	replacePlaceholderPatterns,
} from '@auto-launch/functions/plugins';
import {
	postLaunchFunctions,
	prefetchAssistData,
} from '@auto-launch/functions/setup';
import {
	setThemeRenderingMode,
	updateTemplatePart,
	updateVariation,
} from '@auto-launch/functions/theme';
import { updateNaturalVibeStyles } from '@auto-launch/functions/vibes';
import {
	createBlogSampleData,
	getOption,
	getPageById,
	updateOption,
} from '@auto-launch/functions/wp';
import { useWarnOnLeave } from '@auto-launch/hooks/useWarnOnLeave';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { useAIConsentStore } from '@shared/state/ai-consent';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import useSWRImmutable from 'swr/immutable';

const { homeUrl, showImprint, wpLanguage } = window.extSharedData;

// TODO: I think a good strategy is "if something fails, try to refetch some state"

export const useCreateSite = () => {
	// All the data we need to finish
	const { setErrorMessage, addStatusMessage, needToStall, ...data } =
		useLaunchDataStore();
	const { setUserGaveConsent } = useAIConsentStore();
	const homeStretch = useRef(false);
	const [warnOnReload, setWarnOnReload] = useState(!needToStall());
	const [done, setDone] = useState(false);

	// We keep the data on reload but show this to prevent movement
	useWarnOnLeave(warnOnReload, () => {
		// TODO: do we want to reset state here?
	});

	// needs: title, descriptionRaw
	// provides: siteProfile: { type, category, description, title, keywords, logoObjectName }
	useRunStep(
		'siteProfile',
		() => {
			if (!data.descriptionRaw && !data.title) return null;
			return data;
		},
		handleSiteProfile,
	);

	// needs: siteProfile
	// provides: logoUrl
	useRunStep(
		'siteLogo',
		() => {
			if (!data.siteProfile?.title) return null;
			return data;
		},
		handleSiteLogo,
	);

	// needs: siteProfile
	// provides:sitePlugins: [{name, wordpressSlug}]
	useRunStep(
		'sitePlugins',
		() => {
			// We just need the site profile, which has this
			if (!data.siteProfile?.title) return null;
			return data;
		},
		handleSitePlugins,
	);

	// needs: siteProfile
	// provides: style: {}
	useRunStep(
		'siteStyle',
		() => {
			// We just need the site profile, which has this
			if (!data.siteProfile?.title) return null;
			return data;
		},
		handleSiteStyle,
	);

	// needs: siteProfile
	// provides: aiHeaders: [], aiBlogTitles: []
	useRunStep(
		'siteStrings',
		() => {
			// We just need the site profile, which has this
			if (!data.siteProfile?.title) return null;
			return data;
		},
		handleSiteStrings,
	);

	// needs: siteProfile
	// provides: siteImages: []
	useRunStep(
		'siteImages',
		() => {
			// We just need the site profile, which has this
			if (!data.siteProfile?.title) return null;
			return data;
		},
		handleSiteImages,
	);

	// needs: siteProfile, sitePlugins, siteStyle, siteImages
	// provides: home: { id, slug, patterns, siteStyle }
	useRunStep(
		'home',
		() => {
			// Checking various data from calls above
			const ok = [
				data.siteProfile,
				data.siteStyle,
				data.siteImages,
				data.sitePlugins,
			].every((v) => v !== undefined);
			return ok ? data : null;
		},
		handleHome,
	);

	// 	siteProfile, sitePlugins, siteStyle, siteImages
	// provides: pages: [{ id, slug, name, patterns, siteStyle }]
	useRunStep(
		'pages',
		() => {
			// Checking various data from calls above
			const ok = [
				data.siteProfile,
				data.siteStyle,
				data.siteImages,
				data.sitePlugins,
			].every((v) => v !== undefined);
			return ok ? data : null;
		},
		handlePages,
	);

	// basic defaults
	useRunStep(
		'basicUpdates',
		() => {
			const ok = [data.siteProfile, data.home, data.pages].every(
				(v) => v !== undefined,
			);
			return ok ? data : null;
		},
		async ({ siteProfile, sitePlugins, siteStyle }) => {
			const { title } = siteProfile;
			// translators: this is for a action log UI. Keep it short
			addStatusMessage(__('Adding admin configurations', 'extendify-local'));
			// update permalinks
			await updateOption('permalink_structure', '/%postname%/');
			// make sure consent is set
			setUserGaveConsent(true);
			// Update title
			if (title) await updateOption('blogname', title);

			checkIn({ stage: 'basic_updates', siteProfile, sitePlugins, siteStyle });
		},
	);

	// basic defaults
	useRunStep(
		'pluginConfigurations',
		() => {
			if (!data.sitePlugins) return null;
			return data;
		},
		async () => {
			const activePlugins = await getActivePlugins();
			if (alreadyActive(activePlugins, 'wpforms-lite')) {
				await updateOption('wpforms_activation_redirect', 'skip');
			}
			if (alreadyActive(activePlugins, 'all-in-one-seo-pack')) {
				await updateOption('aioseo_activation_redirect', 'skip');
			}
			if (alreadyActive(activePlugins, 'google-analytics-for-wordpress')) {
				const param = '_transient__monsterinsights_activation_redirect';
				await updateOption(param, null);
			}
		},
	);

	// If we have home and (maybe) pages then we're ready
	useEffect(() => {
		if (needToStall()) return;
		const {
			home,
			pages,
			siteProfile,
			sitePlugins,
			siteStyle,
			addSiteStrings,
			siteImages,
		} = data;
		// pages could be [] and pass here, that's ok
		if (!home || !pages) return;
		if (homeStretch.current) return;
		homeStretch.current = true;
		(async () => {
			const { objective, structure, category } = siteProfile;

			// Do they need an imprint page?
			const needsImprint = Array.isArray(showImprint)
				? showImprint.includes(wpLanguage ?? '') && category === 'Business'
				: false;

			// install fonts and updateVariation
			const customFonts =
				siteStyle?.variation?.settings?.typography?.fontFamilies?.custom;
			let variation = siteStyle?.variation;
			if (customFonts?.length) {
				// translators: this is for a action log UI. Keep it short
				addStatusMessage(__('Installing fonts locally', 'extendify-local'));
				const installed = await installFontFamilies(customFonts).catch(
					() => [],
				);
				variation = mergeFontsIntoVariation(siteStyle.variation, installed);
			}
			await updateVariation(variation);
			// natural-1 is the default vibe
			if (siteStyle?.vibe !== 'natural-1') {
				// translators: vibe in this context is a noun - the feeling of their site design.
				addStatusMessage(__('Setting the website style', 'extendify-local'));
				await updateNaturalVibeStyles(siteStyle?.vibe);
			}

			// navigation menu
			addStatusMessage(__('Working on the navigation', 'extendify-local'));
			const { id: headerNavId } = await createNavigation({
				title: __('Header Navigation', 'extendify-local'),
				slug: 'site-navigation',
			});
			let headerCode = updateNavAttributes(home.headerCode || '', {
				ref: headerNavId,
			});
			// remove the header navigation from the landing page
			if (objective === 'landing-page') {
				// translators: this is for a action log UI. Keep it short
				addStatusMessage(__('Perfecting a landing page', 'extendify-local'));
				const social =
					/<!--\s*wp:social-links\b[^>]*>.*?<!--\s*\/wp:social-links\s*-->/gis;
				headerCode = headerCode
					.replace(/<!--\s*wp:navigation\b[^>]*.*\/-->/gis, '')
					.replace(social, '');
			}
			await updateTemplatePart('extendable/header', headerCode);

			// footer
			let footerNavId = null;
			let footerCode = home.footerCode || '';
			if (needsImprint) {
				const nav = await createNavigation({
					title: __('Footer Navigation', 'extendify-local'),
					slug: 'footer-navigation',
				});
				footerNavId = nav.id;
				footerCode = updateNavAttributes(footerCode, { ref: footerNavId });
			}
			await updateTemplatePart('extendable/footer', footerCode);

			// pages
			// translators: this is for a action log UI. Keep it short
			addStatusMessage(__('Creating pages', 'extendify-local'));
			const pagesToCreate = getPagesToCreate(data);
			const titlePattern = pages?.[0]?.patterns?.find((p) =>
				p.patternTypes?.includes('page-title'),
			);
			if (titlePattern) await updatePageTitlePattern(titlePattern.code);
			// Some patterns have preview html, we can replace those
			// which may install some plugins too.
			const pagesReplaced = [];
			// Run these one page at a time so we don't end up
			// with duplicate dependency issues
			for (const page of pagesToCreate) {
				const patterns = await replacePlaceholderPatterns(page.patterns);
				const updatedPage = { ...page, patterns };
				pagesReplaced.push(updatedPage);
			}
			const customPages = await generatePageContent(pagesReplaced, data);
			const stickyNav =
				structure === 'single-page' && objective !== 'landing-page';
			const createdPagesWP = await createWpPages(customPages, { stickyNav });
			// Aux pages
			const hasBlogPattern = home?.patterns?.some((pattern) =>
				pattern.patternTypes.includes('blog-section'),
			);
			if (objective === 'blog' || hasBlogPattern) {
				// translators: this is for a action log UI. Keep it short
				addStatusMessage(__('Creating blog sample data', 'extendify-local'));
				await createBlogSampleData(addSiteStrings, siteImages);
			}
			// If we have site images then set up the hello world image
			if (siteImages?.length) await setHelloWorldFeaturedImage(siteImages);
			// Do we need an imprint page?
			const imprint = await addImprintPage({ siteStyle }).catch(() => null);

			// install partner plugins
			const activePlugins = await getActivePlugins();
			// Collect pages we need to add to the nav
			const pluginPages = [];
			if (alreadyActive(activePlugins, 'woocommerce')) {
				addStatusMessage(
					// translators: this is for a action log UI. Keep it short
					__('Setting up your online store', 'extendify-local'),
				);
				await apiFetchWithTimeout({
					path: '/extendify/v1/auto-launch/import-woocommerce',
				}).catch(() => null);
				const id = await getOption('woocommerce_shop_page_id');
				const shopPage = id ? await getPageById(id) : null;
				if (shopPage) pluginPages.push(shopPage);
			}
			if (alreadyActive(activePlugins, 'the-events-calendar')) {
				pluginPages.push({
					title: { rendered: __('Events', 'extendify-local') },
					slug: 'events',
					link: `${homeUrl}/events`,
				});
			}

			// Adding pages to the nav
			const pagesWithLinksUpdated =
				structure === 'single-page'
					? await updateSinglePageLinksToSections(createdPagesWP, customPages, {
							objective,
							activePlugins,
						})
					: await updateButtonLinks(createdPagesWP, pluginPages);
			const footerNavPages = [];
			if (footerNavId && imprint?.title) {
				const { originalSlug, title } = imprint;
				footerNavPages.push({
					id: originalSlug,
					name: title.rendered,
					slug: originalSlug,
					patterns: [],
				});
			}

			if (objective !== 'landing-page') {
				if (structure === 'single-page') {
					addSectionLinksToNav;
					await addSectionLinksToNav(
						headerNavId,
						home?.patterns,
						pluginPages,
						createdPagesWP,
					);
				} else {
					await addPageLinksToNav(
						headerNavId,
						pagesToCreate,
						pagesWithLinksUpdated,
						pluginPages,
					);
				}
				if (footerNavId) {
					await addPageLinksToNav(
						footerNavId,
						footerNavPages,
						pagesWithLinksUpdated,
						[],
					);
				}
			}

			await prefetchAssistData();
			await postLaunchFunctions();
			await setThemeRenderingMode('template-locked');
			await updateOption(
				'extendify_onboarding_completed',
				new Date().toISOString(),
			);
			// translators: this is for a action log UI. Keep it short
			addStatusMessage(__('All done!', 'extendify-local'));
			await checkIn({ stage: 'finished', siteProfile, sitePlugins, siteStyle });
			setWarnOnReload(false);
			setDone(true);
		})().catch((error) => {
			console.error(error);
			// if we error here we can try again by resetting the home stretch and stalling again to refetch data
			homeStretch.current = false;
			needToStall(true);
			setErrorMessage(
				__(
					'Something went wrong during the final steps. We will try again but you may need to refresh the page.',
					'extendify-local',
				),
			);
		});
	}, [data, needToStall, setUserGaveConsent]);

	return { done };
};

const useRunStep = (stepKey, getParams, fetcher) => {
	const { setData, setErrorMessage, needToStall } = useLaunchDataStore();
	const p = getParams?.() ?? null;
	const { data, error } = useSWRImmutable(
		p && !needToStall() ? stepKey : null,
		() => fetcher(getParams()),
	);

	useEffect(() => {
		if (!data) return;
		Object.entries(data).forEach(([k, v]) => {
			setData(k, v);
		});
	}, [data, setData]);

	useEffect(() => {
		if (!error || needToStall()) return;
		console.error(error);
		setErrorMessage(
			__(
				'Having some trouble with this step. Trying again...',
				'extendify-local',
			),
		);
	}, [error, setErrorMessage, needToStall]);
};
