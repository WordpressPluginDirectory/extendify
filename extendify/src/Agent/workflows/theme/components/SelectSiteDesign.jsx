import { useSiteVibesOverride } from '@agent/hooks/useSiteVibesOverride';
import { useSiteVibesVariations } from '@agent/hooks/useSiteVibesVariations';
import { useVariationOverride } from '@agent/hooks/useVariationOverride';
import apiFetch from '@wordpress/api-fetch';
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockTypes, parse, serialize } from '@wordpress/blocks';
import { Spinner } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import classnames from 'classnames';

const undoHeroSectionChange = () => {
	document.querySelector('.ext-hero-section-preview')?.remove();

	const heroSectionElement = document.querySelector('.ext-hero-section');

	if (heroSectionElement) heroSectionElement.style.display = 'block';
};

const updateHeroSection = (content) => {
	document.querySelector('.ext-hero-section-preview')?.remove();

	const heroSectionElement = document.querySelector('.ext-hero-section');

	if (heroSectionElement) {
		heroSectionElement.style.display = 'none';
	}

	const contentArea =
		document.querySelector('.entry-content') ?? document.querySelector('main');

	if (!contentArea) return;

	contentArea.insertAdjacentHTML('afterbegin', content);

	const visibleHeroSection = [
		...document.querySelectorAll('.ext-hero-section'),
	].find((el) => el.style.display !== 'none');

	visibleHeroSection?.classList.add('ext-hero-section-preview');
};

const { context } = window.extAgentData;
const isAdmin = context?.adminPage;

const VIEWPORT_WIDTH = 1400;
const PREVIEW_HEIGHT = 200;

const DesignOption = ({ renderedHtml, styles, isSelected, onClick }) => {
	const containerRef = useRef(null);
	const [scale, setScale] = useState(1);
	const [previewHeight, setPreviewHeight] = useState(PREVIEW_HEIGHT);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		setScale(el.offsetWidth / VIEWPORT_WIDTH);
		const obs = new ResizeObserver(([entry]) => {
			setScale(entry.contentRect.width / VIEWPORT_WIDTH);
		});
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	const srcdoc = useMemo(() => {
		const themeStyleHref =
			document.getElementById('extendable-style-css')?.getAttribute('href') ??
			'';
		const wpFontsLocal =
			document.querySelector('style.wp-fonts-local')?.innerHTML ?? '';
		const wpBlockLibraryInline =
			document.getElementById('wp-block-library-inline-css')?.innerHTML ?? '';
		const linkTags = (styles.linkStyles ?? [])
			.map((url) => `<link rel="stylesheet" href="${url}">`)
			.join('\n');
		return `
			<!DOCTYPE html>
			<html>
				<head>
					${themeStyleHref ? `<link rel="stylesheet" href="${themeStyleHref}">` : ''}
					${linkTags}
					${wpFontsLocal ? `<style class="wp-fonts-local">${wpFontsLocal}</style>` : ''}
					${wpBlockLibraryInline ? `<style id="wp-block-library-inline-css">${wpBlockLibraryInline}</style>` : ''}
					<style>${styles.colorAndFontsVariations ?? ''}</style>
					<style>${styles.vibes ?? ''}</style>
					<style>${styles.blockSupportsCss ?? ''}</style>
				</head>
				<body>
					${lowerImageQuality(renderedHtml)}
				</body>
			</html>`;
	}, [
		renderedHtml,
		styles.linkStyles,
		styles.colorAndFontsVariations,
		styles.vibes,
		styles.blockSupportsCss,
	]);

	const handleIframeLoad = (e) => {
		const contentHeight = e.target.contentDocument?.body?.scrollHeight;
		if (contentHeight && scale) {
			setPreviewHeight(
				Math.min(Math.round(contentHeight * scale), PREVIEW_HEIGHT),
			);
		}
	};

	return (
		<button
			ref={containerRef}
			type="button"
			style={{ height: `${previewHeight}px` }}
			className={`relative w-full cursor-pointer overflow-hidden rounded-md border shadow-md ${
				isSelected
					? 'border-design-main ring-wp ring-design-main'
					: 'border-gray-400'
			}`}
			onClick={onClick}
			onKeyDown={(e) => e.key === 'Enter' && onClick()}
		>
			<div
				style={{
					width: VIEWPORT_WIDTH,
					height: previewHeight / scale,
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
				}}
			>
				<iframe
					title={__('Preview site design', 'extendify-local')}
					onLoad={handleIframeLoad}
					srcDoc={srcdoc}
					style={{
						width: '100%',
						height: '100%',
						border: 0,
						pointerEvents: 'none',
					}}
				/>
			</div>
		</button>
	);
};

const lowerImageQuality = (html) =>
	html.replace(
		/(https?:\/\/\S+\?w=\d+)/gi,
		'$1&q=10&auto=format,compress&fm=avif',
	);

const PAGE_SIZE = 5;

export const SelectSiteDesign = ({ onConfirm, onCancel }) => {
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const [heroPatterns, setHeroPatterns] = useState();
	const [colorAndFontsVariations, setColorAndFontsVariations] = useState();
	const [blockEditorStyles, setBlockEditorStyles] = useState();

	const [selectedColorAndFonts, setSelectedColorAndFonts] = useState();
	const [selectedHeroPattern, setSelectedHeroPattern] = useState();
	const [selectedVibe, setSelectedVibe] = useState();

	const { updateSettings } = useDispatch('core/block-editor');

	const injectedLinksRef = useRef([]);

	const injectLinkStyles = (linkStyles) => {
		injectedLinksRef.current.forEach((link) => {
			link.remove();
		});
		injectedLinksRef.current = [];

		(linkStyles ?? []).forEach((href) => {
			if (document.querySelector(`link[href="${href}"]`)) return;
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			document.head.appendChild(link);
			injectedLinksRef.current.push(link);
		});
	};

	const removeInjectedLinks = () => {
		injectedLinksRef.current.forEach((link) => {
			link.remove();
		});
		injectedLinksRef.current = [];
	};

	const { undoChange: undoColorAndFontsChange } = useVariationOverride({
		css: !isAdmin && selectedColorAndFonts?.css,
		duotoneTheme:
			!isAdmin && selectedColorAndFonts?.settings?.color?.duotone?.theme,
	});

	const { undoChange: undoVibesChange } = useSiteVibesOverride({
		css: !isAdmin && selectedVibe?.css,
		slug: !isAdmin && selectedVibe?.slug,
	});

	const { data: vibesData, isLoading: isLoadingVibes } =
		useSiteVibesVariations();

	const vibes = useMemo(() => {
		if (isLoadingVibes) return null;

		const vibes = Object.entries(vibesData.css)
			.filter(([slug]) => slug !== vibesData.currentVibe)
			.map(([slug, css]) => ({
				slug,
				css: css?.replaceAll(slug, 'natural-1'),
			}));

		return [...vibes, ...vibes.slice(0, 3)];
	}, [vibesData, isLoadingVibes]);

	useEffect(() => {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}, []);

	useEffect(() => {
		setIsLoading(true);

		const heroSectionElement = document.querySelector('.ext-hero-section');

		const title = heroSectionElement?.querySelector('h1')?.textContent ?? null;
		const description =
			heroSectionElement?.querySelector('p')?.textContent ?? null;
		const cta =
			heroSectionElement?.querySelector('.wp-block-button__link') ?? null;
		const images = [...(heroSectionElement?.querySelectorAll('img') ?? [])]
			.filter(
				(img) =>
					!img.src.includes('.svg') && !img.src.includes('data:image/svg+xml'),
			)
			.map((img) => {
				try {
					const url = new URL(img.src);
					return url.origin + url.pathname;
				} catch {
					return img.src;
				}
			});

		apiFetch({
			path: '/extendify/v1/agent/site-design-variations',
			method: 'POST',
			data: {
				title,
				images,
				description,
				cta: {
					label: cta?.textContent,
					link: cta?.href,
				},
			},
		})
			.then((data) => {
				setHeroPatterns(data?.patterns?.flat() ?? []);
				setColorAndFontsVariations(data.colorAndFontsVariations);

				setBlockEditorStyles(data?.blockEditorSettings);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	useEffect(() => {
		if (blockEditorStyles) {
			updateSettings(blockEditorStyles);
		}
	}, [blockEditorStyles, updateSettings]);

	const visibleHeroPatterns = heroPatterns?.slice(0, visibleCount);
	const hasMore = visibleCount < heroPatterns?.length;

	const handleCancel = () => {
		undoHeroSectionChange();
		undoColorAndFontsChange();
		undoVibesChange();
		removeInjectedLinks();

		onCancel();
	};

	const handleConfirm = async () => {
		if (!selectedHeroPattern || !selectedVibe || !selectedColorAndFonts) return;

		const postId = context?.postId;

		try {
			const page = await apiFetch({
				path: `/wp/v2/pages/${postId}?context=edit`,
			});

			// parse() depends on block types being registered
			if (getBlockTypes().length === 0) registerCoreBlocks();

			const pageBlocks = parse(page.content.raw);

			let heroPatternUpdated = false;
			const updatedPageBlocks = serialize(
				pageBlocks.map((block) => {
					if (
						heroPatternUpdated ||
						!block.attributes.className.split(' ').includes('ext-hero-section')
					)
						return block;

					heroPatternUpdated = true;

					return parse(selectedHeroPattern.code)?.[0] || block;
				}),
			);

			onConfirm({
				data: {
					updatedPageBlocks,
					postId,
					vibeSlug: selectedVibe.slug,
					colorAndFontsVariation: selectedColorAndFonts,
				},
				shouldRefreshPage: true,
			});
		} catch (error) {
			console.log(error);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading || isLoadingVibes) {
		return (
			<div className="flex justify-center flex-col gap-1">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="mb-4 ml-10 mr-2 flex flex-col rounded-lg border border-gray-300 bg-gray-50 rtl:ml-2 rtl:mr-10">
			<div className="rounded-lg border-b border-gray-300 bg-white">
				<div className="flex flex-col gap-4 p-3">
					{visibleHeroPatterns?.map((heroPattern, i) => (
						<DesignOption
							key={heroPattern.id}
							renderedHtml={heroPattern.renderedHtml}
							isSelected={selectedHeroPattern?.id === heroPattern.id}
							styles={{
								linkStyles: heroPattern.linkStyles,
								colorAndFontsVariations: colorAndFontsVariations[i].css,
								vibes: vibes[i]?.css,
								blockSupportsCss: heroPattern.blockSupportsCss,
							}}
							onClick={() => {
								setSelectedHeroPattern(heroPattern);
								setSelectedColorAndFonts(colorAndFontsVariations[i]);
								setSelectedVibe(vibes[i]);

								if (!isAdmin) {
									const blockSupportsCss = heroPattern.blockSupportsCss;
									if (blockSupportsCss) {
										let el = document.getElementById('ext-block-supports-css');
										if (!el) {
											el = document.createElement('style');
											el.id = 'ext-block-supports-css';
											document.head.appendChild(el);
										}
										el.textContent = blockSupportsCss;
									}

									injectLinkStyles(heroPattern.linkStyles);

									updateHeroSection(heroPattern.renderedHtml);
								}
							}}
						/>
					))}

					{hasMore && (
						<button
							type="button"
							className={classnames(
								'w-full rounded-sm border border-gray-300 bg-white p-2 text-sm text-gray-800',
								{
									'hover:bg-gray-50': !isSaving,
								},
							)}
							onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
							disabled={isSaving}
						>
							{__('Load more', 'extendify-local')}
						</button>
					)}
				</div>
			</div>
			<div className="flex justify-start gap-2 p-3">
				<button
					type="button"
					className={classnames(
						'w-full rounded-sm border border-gray-300 bg-white p-2 text-sm text-gray-800',
						{
							'hover:bg-gray-50': !isSaving,
						},
					)}
					onClick={handleCancel}
					disabled={isSaving}
				>
					{__('Cancel', 'extendify-local')}
				</button>
				<button
					type="button"
					className={classnames(
						'w-full rounded-sm border border-design-main bg-design-main p-2 text-sm text-white',
						{
							'cursor-not-allowed': !selectedHeroPattern || isSaving,
							'hover:bg-gray-800': !isSaving,
						},
					)}
					disabled={!selectedHeroPattern || isSaving}
					onClick={handleConfirm}
				>
					{isSaving ? (
						<Spinner className="m-0" />
					) : (
						__('Save', 'extendify-local')
					)}
				</button>
			</div>
		</div>
	);
};
