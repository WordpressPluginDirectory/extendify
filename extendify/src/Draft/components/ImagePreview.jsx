import { store as blockEditorStore } from '@wordpress/block-editor';
import { Button, Spinner } from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as editPostStore } from '@wordpress/edit-post';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { importImage, importImageServer } from '@draft/api/WPApi';

export const ImagePreview = ({ imagePrompt, isGenerating, src, setSrc }) => {
	const { openGeneralSidebar } = useDispatch(editPostStore);
	const { updateBlockAttributes } = useDispatch('core/block-editor');
	const [isInserting, setIsInserting] = useState(false);
	const selectedBlock = useSelect(
		(select) => select(blockEditorStore).getSelectedBlock(),
		[],
	);

	const handleInsert = async (event) => {
		event.preventDefault();
		setIsInserting(true);
		let image;
		try {
			image = await importImage(src, {
				alt: '',
				filename: 'image.jpg',
				caption: '',
			});
		} catch (_e) {
			image = await importImageServer(src, {
				alt: '',
				filename: 'image.jpg',
				caption: '',
			});
		}
		if (!image) return;

		if (selectedBlock.name === 'core/image') {
			updateBlockAttributes(selectedBlock.clientId, {
				id: image.id,
				caption: image.caption.raw,
				url: image.source_url,
				alt: image.alt_text,
			});
		}

		if (selectedBlock.name === 'core/media-text') {
			updateBlockAttributes(selectedBlock.clientId, {
				mediaId: image.id,
				caption: image.caption.raw,
				mediaUrl: image.source_url,
				mediaAlt: image.alt_text,
				mediaType: 'image',
			});
		}

		setIsInserting(false);
		openGeneralSidebar('edit-post/block');
	};

	if (src === '' && !isGenerating) return null;

	return (
		<div className="flex flex-col gap-5">
			<AnimatePresence>
				{isGenerating ? (
					<motion.div
						initial={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="w-full aspect-square flex justify-center items-center"
						style={{
							background:
								'linear-gradient(135deg, #E8E8E8 47.92%, #F3F3F3 60.42%, #E8E8E8 72.92%)',
						}}>
						<Spinner style={{ height: '48px', width: '48px' }} />
					</motion.div>
				) : (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="aspect-square bg-gray-100">
						<img src={src} className="w-full aspect-square block" />
					</motion.div>
				)}
			</AnimatePresence>
			{isGenerating ? (
				<p>
					{__('Generating your image: ', 'extendify-local')}
					<span className="font-bold">&quot;{imagePrompt}&quot;</span>
				</p>
			) : (
				<form onSubmit={handleInsert} className="flex flex-col gap-5">
					<Button
						type="submit"
						autoFocus
						className="w-full justify-center"
						variant="primary"
						disabled={isInserting}>
						{isInserting
							? // translators: "Importing image" means the image is being added to the WordPress post editor
							  __('Importing image...', 'extendify-local')
							: __('Use this image', 'extendify-local')}
					</Button>
					<Button
						className="w-full justify-center bg-gray-200 text-gray-800 disabled:bg-gray-300 disabled:text-gray-700"
						onClick={() => setSrc('')}
						disabled={isInserting}>
						{__('Delete image', 'extendify-local')}
					</Button>
				</form>
			)}
		</div>
	);
};
