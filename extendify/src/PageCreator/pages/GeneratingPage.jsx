import { rawHandler } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { useEffect, useRef, useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';
import { updateOption } from '@page-creator/api/WPApi';
import { VideoPlayer } from '@page-creator/components/content/VideoPlayer';
import { usePageCustomContent } from '@page-creator/hooks/usePageCustomContent';
import { processPatterns } from '@page-creator/lib/processPatterns';
import { useGlobalsStore } from '@page-creator/state/global';
import { installBlocks } from '@page-creator/util/installBlocks';

const { pageTitlePattern } = window.extPageCreator;

export const GeneratingPage = ({ insertPage }) => {
	const { page, loading } = usePageCustomContent();
	const { progress, setProgress } = useGlobalsStore();
	const { editPost } = useDispatch(editorStore);
	const [patterns, setPatterns] = useState([]);
	const once = useRef(false);
	const theme = useSelect((select) => select('core').getCurrentTheme());

	useEffect(() => {
		if (!page && loading) return;
		if (once.current) return;
		once.current = true;

		setProgress(
			__(
				'Processing patterns and installing required plugins...',
				'extendify-local',
			),
		);
		(async () => {
			const patterns = await processPatterns(page?.patterns);
			await installBlocks({ patterns });
			setPatterns(patterns);
		})();
	}, [loading, page, setPatterns, setProgress]);

	useEffect(() => {
		if (!patterns?.length || !once.current) return;

		const code = patterns.flatMap(({ code }) => {
			// Check if the pattern is a page title, and use the stashed one
			let pattern = code;
			if (pageTitlePattern && code.includes('"name":"Page Title"')) {
				const titleRegex = /<h1([^>]*)>[\da-zA-z]+<\/h1>/g;
				const titleCb = (_, attributes) =>
					`<h1${attributes}>${page.title}</h1>`;
				pattern = decodeEntities(pageTitlePattern).replaceAll(
					titleRegex,
					titleCb,
				);
			}

			// find links with #extendify- like href="#extendify-hero-cta"
			const linksRegex = /href="#extendify-([^"]+)"/g;
			const c = pattern.replaceAll(linksRegex, 'href="#"');

			return rawHandler({ HTML: c });
		});

		if (theme?.textdomain && theme?.textdomain === 'extendable') {
			// Set page template to no-title if they have it
			editPost({ template: 'no-title' }).catch(() => {});
		}

		// Signal to the importer to check for images
		updateOption('extendify_check_for_image_imports', true);

		let id = setTimeout(() => insertPage(code, page.title), 1000);

		return () => clearTimeout(id);
	}, [insertPage, patterns, editPost, page, theme]);

	return (
		<div className="mx-auto flex flex-grow items-center justify-center">
			<div className="mx-auto flex h-full flex-col justify-center">
				<VideoPlayer
					poster={`${window.extSharedData.assetPath}/site-building.webp`}
					path="https://images.extendify-cdn.com/launch/site-building.webm"
					className="mx-auto h-auto w-[200px] md:w-[400px]"
				/>
				{progress && (
					<p className="text-center text-lg" aria-live="polite">
						{progress}
					</p>
				)}
			</div>
		</div>
	);
};
