import { rawHandler } from '@wordpress/blocks';
import { useDispatch } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { useEffect } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { updateOption } from '@page-creator/api/WPApi';
import { VideoPlayer } from '@page-creator/components/content/VideoPlayer';
import { usePageCustomContent } from '@page-creator/hooks/usePageCustomContent';
import { useGlobalsStore } from '@page-creator/state/global';

const { pageTitlePattern } = window.extPageCreator;

export const GeneratingPage = ({ insertPage }) => {
	const { page, loading } = usePageCustomContent();
	const { progress } = useGlobalsStore();
	const { editPost } = useDispatch(editorStore);

	useEffect(() => {
		if (!page && loading) return;
		const code = page?.patterns.flatMap(({ code, patternReplacementCode }) => {
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

			const r = patternReplacementCode?.replaceAll(linksRegex, 'href="#"');
			return rawHandler({ HTML: r ?? c });
		});

		// Set page template to no-title if they have it
		editPost({ template: 'no-title' }).catch(() => {});

		// Signal to the importer to check for images
		updateOption('extendify_check_for_image_imports', true);

		let id = setTimeout(() => insertPage(code, page.title), 1000);
		return () => clearTimeout(id);
	}, [loading, page, insertPage, editPost]);

	return (
		<div className="mx-auto grow overflow-y-auto px-4 py-8 md:p-12 md:px-6 3xl:p-16">
			<div className="mx-auto flex h-full flex-col justify-center">
				<VideoPlayer
					path="https://assets.extendify.com/launch/site-building.webm"
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
