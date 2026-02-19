import { walkAndUpdateImageDetails } from '@agent/lib/blocks';
import { useChatStore } from '@agent/state/chat';
import { useWorkflowStore } from '@agent/state/workflows';
import { generateImage } from '@shared/api/DataApi';
import { downloadImage } from '@shared/api/wp';
import { useImageGenerationStore } from '@shared/state/generate-images';
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockTypes } from '@wordpress/blocks';
import { Spinner } from '@wordpress/components';
import { humanTimeDiff } from '@wordpress/date';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

const preload = (src) =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(src);
		img.onerror = reject;
		img.src = src;
	});

export const GenerateImageConfirm = ({
	inputs,
	onConfirm,
	onCancel,
	onRetry,
}) => {
	const [generatedImage, setGeneratedImage] = useState(null);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState(null);
	const [refreshCheck, setRefreshCheck] = useState(0);
	const [importing, setImporting] = useState(false);
	const {
		imageCredits,
		updateImageCredits,
		subtractOneCredit,
		resetImageCredits,
	} = useImageGenerationStore();
	const { addMessage, messages } = useChatStore();
	const { block } = useWorkflowStore();
	const noCredits = Number(imageCredits.remaining) === 0;

	const handleConfirm = async () => {
		if (importing) return;
		setImporting(true);
		try {
			const importedImage = await downloadImage(
				null,
				generatedImage,
				'ai-generated',
			);
			await onConfirm({
				data: {
					previousContent: inputs.previousContent,
					newContent: walkAndUpdateImageDetails(inputs, importedImage),
				},
				shouldRefreshPage: true,
			});
		} catch (err) {
			setImporting(false);
			setError(err?.message || __('Failed to save image', 'extendify-local'));
		}
	};

	const resetImagePreview = useCallback(() => {
		if (!generatedImage) return false;
		// The CSS.escape() method can also be used for escaping strings
		// https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape_static
		const imageElement = document.querySelector(
			`[data-extendify-agent-block-id="${block?.id}"] > img[src="${CSS.escape(generatedImage)}"]`,
		);
		if (imageElement) {
			imageElement.src = inputs.url;
			return true;
		}
		return false;
	}, [block?.id, generatedImage, inputs.url]);

	const handleCancel = useCallback(() => {
		if (!generatedImage) {
			onCancel();
			return;
		}
		resetImagePreview();
		onCancel();
	}, [onCancel, generatedImage, resetImagePreview]);

	const handleRetry = useCallback(() => {
		resetImagePreview();
		onRetry();
	}, [onRetry, resetImagePreview]);

	useEffect(() => {
		if (getBlockTypes().length !== 0) return;
		registerCoreBlocks();
	}, []);

	useEffect(() => {
		if (generatedImage || noCredits) return;

		setGenerating(true);
		subtractOneCredit();
		const generate = async () => {
			try {
				const { imageCredits, images } = await generateImage({
					prompt: inputs.prompt,
				});
				updateImageCredits(imageCredits);
				const url = images?.[0]?.url;
				if (!url) throw new Error(__('No image returned', 'extendify-local'));
				await preload(url);
				setGeneratedImage(url);
				setGenerating(false);
			} catch (e) {
				setError(
					e?.message || __('An unknown error occurred.', 'extendify-local'),
				);
				if (e?.imageCredits) updateImageCredits(e.imageCredits);
				setGenerating(false);
			}
		};

		generate();
	}, [
		inputs.prompt,
		generatedImage,
		noCredits,
		subtractOneCredit,
		updateImageCredits,
	]);

	// Copied from Draft. Maybe not the best way to do this.
	useEffect(() => {
		const handle = () => {
			setRefreshCheck((prev) => prev + 1);
			if (!imageCredits.refresh) return;
			if (new Date(Number(imageCredits.refresh)) > new Date()) return;
			resetImageCredits();
		};
		if (refreshCheck === 0) handle(); // First run
		const id = setTimeout(handle, 1000);
		return () => clearTimeout(id);
	}, [imageCredits, resetImageCredits, refreshCheck]);

	useEffect(() => {
		if (!generatedImage) return;
		const originalImage = document.querySelector(
			`[data-extendify-agent-block-id="${block?.id}"] > img[src="${CSS.escape(inputs.url)}"]`,
		);
		if (!originalImage) return;
		originalImage.srcset = '';
		// replace the original image source with the new image url
		originalImage.src = generatedImage;
	}, [generatedImage, inputs.url, block?.id]);

	useEffect(() => {
		if (!error) return;
		const timer = setTimeout(() => handleCancel(), 100);
		const content = sprintf(
			// translators: A chat message shown to the user
			__('Error generating image: %s', 'extendify-local'),
			error,
		);
		const last = messages.at(-1)?.details?.content;
		if (content === last) return () => clearTimeout(timer);
		addMessage('message', { role: 'assistant', content, error: true });
		return () => clearTimeout(timer);
	}, [error, handleCancel, addMessage, messages]);

	useEffect(() => {
		if (!noCredits || generating || generatedImage) return;
		const cancelTimer = setTimeout(() => handleCancel(), 1500);
		const content = sprintf(
			// translator: %s is the time until credits reset.
			__(
				"It looks like you've run out of credits. They'll refresh in %s, so check back then.",
				'extendify-local',
			),
			humanTimeDiff(new Date(Number(imageCredits.refresh))),
		);
		const last = messages.at(-1)?.details?.content;
		if (content === last) return () => clearTimeout(cancelTimer);
		const messageTimer = setTimeout(() => {
			addMessage('message', { role: 'assistant', content, error: true });
		}, 1000);
		return () => {
			clearTimeout(cancelTimer);
			clearTimeout(messageTimer);
		};
	}, [
		noCredits,
		generating,
		generatedImage,
		handleCancel,
		addMessage,
		messages,
		imageCredits.refresh,
	]);

	if (error || (!generatedImage && noCredits && !generating)) return null;

	if (generating) {
		return (
			<Wrapper>
				<Content>
					<p className="m-0 p-0 flex gap-0.5 items-center text-sm text-gray-900">
						<Spinner className="my-0 h-4 w-4" />
						<span>{__('Generating image...', 'extendify-local')}</span>
					</p>
				</Content>
			</Wrapper>
		);
	}

	return (
		<Wrapper>
			<Content>
				<p className="m-0 p-0 text-sm text-gray-900">
					{__('Image generated successfully!', 'extendify-local')}
				</p>
			</Content>
			<div className="flex justify-start gap-2 p-3">
				<button
					type="button"
					className="flex-1 rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900"
					onClick={handleCancel}
				>
					{__('Cancel', 'extendify-local')}
				</button>
				<button
					type="button"
					className="flex-1 rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900 disabled:opacity-50"
					onClick={handleRetry}
					disabled={importing || noCredits}
				>
					{__('Try Again', 'extendify-local')}
				</button>
				<button
					type="button"
					className="flex-1 rounded border border-design-main bg-design-main p-2 text-sm text-white disabled:opacity-50"
					disabled={importing}
					onClick={handleConfirm}
				>
					{importing
						? __('Saving...', 'extendify-local')
						: __('Save', 'extendify-local')}
				</button>
			</div>
			<div className="text-pretty px-4 pb-2 text-center text-xss leading-none text-gray-700">
				{sprintf(
					// translators: %1$s is the number of credits remaining, %2$s is the total credits
					__(
						'You have %1$s of %2$s daily image credits remaining.',
						'extendify-local',
					),
					imageCredits.remaining,
					imageCredits.total,
				)}
			</div>
		</Wrapper>
	);
};

const Wrapper = ({ children }) => (
	<div className="mb-4 ml-10 mr-2 flex flex-col rounded-lg border border-gray-300 bg-gray-50 rtl:ml-2 rtl:mr-10">
		{children}
	</div>
);

const Content = ({ children }) => (
	<div className="rounded-lg border-b border-gray-300 bg-white">
		<div className="p-3">{children}</div>
	</div>
);
