import { handleDesignBuild } from '@auto-launch/fetchers/get-design-build';
import { handleHome } from '@auto-launch/fetchers/get-home';
import { handleSiteImages } from '@auto-launch/fetchers/get-images';
import { handleLaunchDecisions } from '@auto-launch/fetchers/get-launch-decisions';
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
import { apiFetchWithTimeout, setStatus } from '@auto-launch/functions/helpers';
import { checkIn } from '@auto-launch/functions/insights';
import {
	updateButtonLinks,
	updateSinglePageLinksToSections,
} from '@auto-launch/functions/links';
import {
	addPageLinksToNav,
	addSectionLinksToNav,
	createNavigation,
	injectNavExtras,
	updateNavAttributes,
} from '@auto-launch/functions/nav';
import {
	addImprintPage,
	createWpPages,
	getPagesToCreate,
	PLUGIN_OWNED_PAGES,
	setHelloWorldFeaturedImage,
	updatePageTitlePattern,
} from '@auto-launch/functions/pages';
import { generatePageContent } from '@auto-launch/functions/patterns';
import {
	activatePlugin,
	alreadyActive,
	getActivePlugins,
	installPlugin,
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
import { computeVibeAdjustedBlocks } from '@auto-launch/functions/vibes';
import {
	createBlogSampleData,
	getOption,
	getPageById,
	storeSiteImages,
	updateOption,
} from '@auto-launch/functions/wp';
import { useWarnOnLeave } from '@auto-launch/hooks/useWarnOnLeave';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { digest } from '@shared/api/digest';
import { useAIConsentStore } from '@shared/state/ai-consent';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import useSWRImmutable from 'swr/immutable';

const { homeUrl, showImprint, wpLanguage, installedPluginsSlugs } =
	window.extSharedData;

// TODO: I think a good strategy is "if something fails, try to refetch some state"

export const useCreateSite = () => {
	// All the data we need to finish
	const { setErrorMessage, addStatusMessage, needToStall, setData, ...data } =
		useLaunchDataStore();
	const { setUserGaveConsent } = useAIConsentStore();
	const homeStretch = useRef(false);
	const [warnOnReload, setWarnOnReload] = useState(!needToStall());
	const [done, setDone] = useState(false);

	// We keep the data on reload but show this to prevent movement
	useWarnOnLeave(warnOnReload, () => {
		checkIn({ stage: 'exit_early' });
	});

	// needs: urlParams['build-id']
	// provides: designBuild, siteProfile, siteStyle
	useRunStep(
		'designBuild',
		() => {
			if (!data.urlParams?.['build-id']) return null;
			return data;
		},
		handleDesignBuild,
	);

	// needs: title, descriptionRaw (or designBuild when build-id)
	// provides: siteProfile: { type, category, description, title, keywords, logoObjectName }
	useRunStep(
		'siteProfile',
		() => {
			if (!data.descriptionRaw && !data.title) return null;
			return data;
		},
		async (params) => {
			checkIn({ stage: 'get_profile' });
			return await handleSiteProfile(params);
		},
	);

	// needs: siteProfile
	// provides: logoUrl
	useRunStep(
		'siteLogo',
		() => {
			if (!data.siteProfile?.title) return null;
			return data;
		},
		async (params) => {
			checkIn({ stage: 'get_logo' });
			return await handleSiteLogo(params);
		},
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
		async (params) => {
			checkIn({ stage: 'get_plugins' });
			return await handleSitePlugins(params);
		},
	);

	useEffect(() => {
		// Start installing the partner plugins asap
		if (!data.sitePlugins?.length) return;

		setStatus(
			// translators: this is for a action log UI. Keep it short
			__('Setting up functionality for your website', 'extendify-local'),
		);
		(async function install() {
			for (const { wordpressSlug: slug } of data.sitePlugins) {
				let plugin;
				if (!installedPluginsSlugs?.includes(slug)) {
					plugin = await installPlugin(slug);
				}
				await activatePlugin(plugin?.plugin ?? slug);
			}
		})();
	}, [data.sitePlugins]);

	// needs: siteProfile
	// provides: style: {}
	useRunStep(
		'siteStyle',
		() => {
			// We just need the site profile, which has this
			if (!data.siteProfile?.title) return null;
			return data;
		},
		async (params) => {
			checkIn({ stage: 'get_style' });
			return await handleSiteStyle(params);
		},
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
		async (params) => {
			checkIn({ stage: 'get_strings' });
			return await handleSiteStrings(params);
		},
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
		async (params) => {
			checkIn({ stage: 'get_images' });
			return await handleSiteImages(params);
		},
	);

	// needs: siteProfile
	// provides: launchDecisions: { navExtras, navButtonLabel }
	useRunStep(
		'launchDecisions',
		() => {
			if (!data.siteProfile?.title) return null;
			return data;
		},
		async (params) => {
			checkIn({ stage: 'get_launch_decisions' });
			return await handleLaunchDecisions(params);
		},
	);

	// needs: siteProfile, sitePlugins, siteStyle, siteImages, aiHeaders
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
				data.aiHeaders,
			].every((v) => v !== undefined);
			return ok ? data : null;
		},
		async (params) => {
			checkIn({ stage: 'get_home' });
			return await handleHome(params);
		},
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
		async (params) => {
			checkIn({ stage: 'get_pages' });
			return await handlePages(params);
		},
	);

	// basic defaults
	useRunStep(
		'generalUpdates',
		() => {
			const ok = [data.siteProfile, data.home, data.pages].every(
				(v) => v !== undefined,
			);
			return ok ? data : null;
		},
		async ({ siteProfile, sitePlugins, siteStyle }) => {
			checkIn({ stage: 'set_general', siteProfile, sitePlugins, siteStyle });

			const { title } = siteProfile;
			// translators: this is for a action log UI. Keep it short
			addStatusMessage(__('Adding admin configurations', 'extendify-local'));
			// update permalinks
			await updateOption('permalink_structure', '/%postname%/');
			// make sure consent is set
			setUserGaveConsent(true);
			// Update title
			if (title) await updateOption('blogname', title);
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
			checkIn({ stage: 'set_plugin_config' });
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
			aiBlogTitles,
			siteImages,
			designBuild,
			launchDecisions,
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

			const customFonts =
				siteStyle?.variation?.settings?.typography?.fontFamilies?.custom;
			let variation = siteStyle?.variation;
			if (customFonts?.length) {
				checkIn({ stage: 'install_fonts' });
				// translators: this is for a action log UI. Keep it short
				addStatusMessage(__('Installing fonts locally', 'extendify-local'));
				const installed = await installFontFamilies(customFonts).catch(
					() => [],
				);
				variation = mergeFontsIntoVariation(siteStyle.variation, installed);
			}

			if (siteStyle?.vibe && siteStyle.vibe !== 'natural-1') {
				// translators: vibe in this context is a noun - the feeling of their site design.
				addStatusMessage(__('Setting the website style', 'extendify-local'));
				checkIn({ stage: 'compute_vibe' });
				const vibeBlocks = await computeVibeAdjustedBlocks(
					siteStyle.vibe,
				).catch(() => null);
				if (vibeBlocks) {
					variation = {
						...variation,
						styles: { ...variation.styles, blocks: vibeBlocks },
					};
				}
			}

			checkIn({ stage: 'set_vibe' });
			await updateVariation(variation);

			// navigation menu
			addStatusMessage(__('Working on the navigation', 'extendify-local'));
			const { id: headerNavId } = await createNavigation({
				title: __('Header Navigation', 'extendify-local'),
				slug: 'site-navigation',
			});
			let headerCode = updateNavAttributes(home.headerCode || '', {
				ref: headerNavId,
			});
			headerCode = injectNavExtras(headerCode, launchDecisions);
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
			headerCode = headerCode.replaceAll(
				'206-555-0100',
				(typeof siteProfile.phoneNumber === 'string' &&
					siteProfile.phoneNumber) ||
					// translators: Use a number that is appropriate for the locale. It does not need to be this exact number. This is a placeholder phone number. For example, in pt_BR you could use (11) 91234-5678.
					__('206-555-0100', 'extendify-local'),
			);
			checkIn({ stage: 'set_navigation' });

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
			checkIn({ stage: 'set_footer' });
			await updateTemplatePart('extendable/footer', footerCode);

			// pages
			// translators: this is for a action log UI. Keep it short
			addStatusMessage(__('Creating pages', 'extendify-local'));
			const pagesToCreate = getPagesToCreate(data);
			const titlePattern = pages?.[0]?.patterns?.find((p) =>
				p.patternTypes?.includes('page-title'),
			);
			if (titlePattern) {
				checkIn({ stage: 'set_page_title_pattern' });
				await updatePageTitlePattern(titlePattern.code);
			}

			const activePlugins = await getActivePlugins();
			// This lets us keep plugin pages in th enav but skip making the page
			const reservedSlugs = new Set(
				PLUGIN_OWNED_PAGES.filter(
					({ plugin }) =>
						sitePlugins.some((p) => p.wordpressSlug === plugin) ||
						alreadyActive(activePlugins, plugin),
				).map(({ slug }) => slug),
			);
			const pagesToActuallyCreate = pagesToCreate.filter(
				(p) => !reservedSlugs.has(p.slug),
			);

			// Some patterns have preview html, we can replace those
			// which may install some plugins too.
			const pagesReplaced = [];
			// Run these one page at a time so we don't end up
			// with duplicate dependency issues
			checkIn({ stage: 'replace_placeholder_patterns' });
			for (const page of pagesToActuallyCreate) {
				const patterns = await replacePlaceholderPatterns(page.patterns);
				const updatedPage = { ...page, patterns };
				pagesReplaced.push(updatedPage);
			}
			checkIn({ stage: 'generate_page_content' });
			const customPages = await generatePageContent(pagesReplaced, data);

			// Update heroDescription to the actual AI-rewritten hero content
			const homePage = customPages.find((p) => p.slug === 'home');
			const heroPattern = homePage?.patterns?.find((p) =>
				p.patternTypes?.includes('hero-header'),
			);
			const pMatch = heroPattern?.code?.match(/<p[^>]*>([\s\S]*?)<\/p>/);
			const heroDesc = pMatch?.[1]?.replace(/<[^>]+>/g, '').trim();
			setData('heroDescription', heroDesc || data.heroDescription);

			const createdPagesWP = await createWpPages(customPages);
			// Aux pages
			const hasBlogPattern = home?.patterns?.some((pattern) =>
				pattern.patternTypes.includes('blog-section'),
			);
			if (objective === 'blog' || hasBlogPattern) {
				checkIn({ stage: 'create_blog_sample_data' });
				// translators: this is for a action log UI. Keep it short
				addStatusMessage(__('Creating blog sample data', 'extendify-local'));
				await createBlogSampleData({ aiBlogTitles }, siteImages);
			}
			// If we have site images then set up the hello world image
			if (siteImages?.length) {
				checkIn({ stage: 'set_hello_world_image' });
				await setHelloWorldFeaturedImage(siteImages);
			}

			let imprint = {};
			if (needsImprint) {
				checkIn({ stage: 'create_imprint' });
				imprint = await addImprintPage({ siteStyle }).catch(() => null);
			}

			const pluginPages = [];
			if (alreadyActive(activePlugins, 'woocommerce')) {
				checkIn({ stage: 'import_woocommerce_products' });
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
			checkIn({ stage: 'set_page_links' });
			const linksResult =
				structure === 'single-page'
					? await updateSinglePageLinksToSections(
							createdPagesWP,
							customPages,
							{
								objective,
								activePlugins,
								landingPageCTALink: siteProfile.landingPageCTALink,
							},
							headerCode,
						)
					: await updateButtonLinks(createdPagesWP, pluginPages, headerCode);
			const pagesWithLinksUpdated = linksResult.wpPages;
			headerCode = linksResult.headerCode;
			await updateTemplatePart('extendable/header', headerCode);
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

			checkIn({ stage: 'set_navigation_links' });
			if (objective !== 'landing-page') {
				const orderedSlugs = designBuild?.pages?.map((p) => p.slug) ?? [];
				if (structure === 'single-page') {
					await addSectionLinksToNav(
						headerNavId,
						home?.patterns,
						pluginPages,
						createdPagesWP,
						{ orderedSlugs },
					);
				} else {
					await addPageLinksToNav(
						headerNavId,
						pagesToCreate,
						pagesWithLinksUpdated,
						pluginPages,
						{ orderedSlugs },
					);
				}
				if (footerNavId) {
					await addPageLinksToNav(
						footerNavId,
						footerNavPages,
						imprint?.id
							? [...pagesWithLinksUpdated, imprint]
							: pagesWithLinksUpdated,
						[],
					);
				}
			}

			checkIn({ stage: 'prefetch_assist_data' });
			await prefetchAssistData();
			checkIn({ stage: 'final_steps' });
			await setThemeRenderingMode('template-locked');
			await postLaunchFunctions();
			if (siteImages?.length) {
				await storeSiteImages(siteImages).catch(() => null);
			}
			// translators: this is for a action log UI. Keep it short
			addStatusMessage(__('All done!', 'extendify-local'));
			await checkIn({ stage: 'finished', siteProfile, sitePlugins, siteStyle });
			setWarnOnReload(false);
			setDone(true);
		})().catch((error) => {
			console.error(error);
			digest({
				error,
				details: { source: 'auto-launch', caller: 'create-site' },
			});
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
		digest({ error, details: { source: 'auto-launch', caller: 'run-step' } });
		setErrorMessage(
			__(
				'Having some trouble with this step. Trying again...',
				'extendify-local',
			),
		);
	}, [error, setErrorMessage, needToStall]);
};
