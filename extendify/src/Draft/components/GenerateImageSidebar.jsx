import { BaseControl, Panel, PanelBody } from '@wordpress/components';
import { useState, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { generateImage } from '@draft/api/Data';
import { useGlobalStore } from '@draft/state/global';
import { GenerateForm } from './GenerateForm';
import { ImagePreview } from './ImagePreview';

export const GenerateImageSidebar = () => {
	const {
		imageCredits: curCredits,
		updateImageCredits,
		subtractOneCredit,
	} = useGlobalStore();
	const [imagePrompt, setImagePrompt] = useState('');
	const [isGenerating, setIsGenerating] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [src, setSrc] = useState('');
	const abortController = useRef(null);
	const noCredits = curCredits.remaining === 0;

	const handleSubmit = async (event) => {
		event.preventDefault();
		setErrorMessage('');
		if (noCredits || isGenerating) {
			abortController.current?.abort();
			return;
		}

		try {
			setIsGenerating(true);
			subtractOneCredit();
			abortController.current = new AbortController();
			const { imageCredits, images } = await generateImage(
				imagePrompt,
				abortController.current.signal,
			);
			updateImageCredits(imageCredits);
			setSrc(images[0].url);
		} catch (error) {
			// If the request was aborted (cancelled), don't show an error
			if (error?.code === 20) return;
			// If we didn't get back any credit info, it was a server error
			if (!error?.imageCredits) {
				// Pause to prefent flickering
				await new Promise((resolve) => setTimeout(resolve, 1000));
				setErrorMessage(error.message);
				// Add back the credit we subtracted
				updateImageCredits({ remaining: curCredits.remaining });
				return;
			}
			// Probably out of credits here
			updateImageCredits(error.imageCredits);
			setErrorMessage(error.message);
		} finally {
			setIsGenerating(false);
		}
	};

	useEffect(() => {
		if (src || isGenerating) return;
		// refocus when image is removed
		document.getElementById('draft-ai-image-textarea')?.focus();
	}, [src, isGenerating]);

	return (
		<>
			<Panel>
				<PanelBody>
					<BaseControl label={__('Image Description', 'extendify-local')}>
						<ImagePreview
							imagePrompt={imagePrompt}
							isGenerating={isGenerating}
							src={src}
							setSrc={setSrc}
						/>
						{src ? null : (
							<form onSubmit={handleSubmit} className="flex flex-col gap-5">
								<GenerateForm
									isGenerating={isGenerating}
									errorMessage={errorMessage}
									imagePrompt={imagePrompt}
									setImagePrompt={setImagePrompt}
								/>
							</form>
						)}
					</BaseControl>
				</PanelBody>
			</Panel>
		</>
	);
};
