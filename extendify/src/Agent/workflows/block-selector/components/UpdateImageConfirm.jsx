import { walkAndUpdateImageDetails } from '@agent/lib/blocks';
import {
	addCustomMediaViewsCss,
	removeCustomMediaViewsCss,
} from '@agent/lib/media-views';
import { useWorkflowStore } from '@agent/state/workflows';
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockTypes } from '@wordpress/blocks';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { MediaUpload } from '@wordpress/media-utils';

const openButton = __('Open Media Library', 'extendify-local');

export const UpdateImageConfirm = ({ inputs, onConfirm, onCancel }) => {
	const [showConfirmation, setShowConfirmation] = useState(false);
	const [selectedImage, setSelectedImage] = useState(null);
	const { block } = useWorkflowStore();

	const previewImage = (image) => {
		// Query the DOM based on the block id and the image url
		const originalImage = document.querySelector(
			// The CSS.escape() method can also be used for escaping strings
			// https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape_static
			`[data-extendify-agent-block-id="${block?.id}"] > img[src="${CSS.escape(inputs.url)}"]`,
		);
		if (!originalImage) return;
		originalImage.srcset = '';
		// replace the original image source with the new image url
		originalImage.src = image.url;
		// show the confirmation message
		setShowConfirmation(true);
		// save the image in the state to be used later in onConfirm and onCancel
		setSelectedImage(image);
	};

	const handleConfirm = async () => {
		if (!selectedImage) return;
		await onConfirm({
			data: {
				previousContent: inputs.previousContent,
				newContent: walkAndUpdateImageDetails(inputs, selectedImage),
			},
			shouldRefreshPage: true,
		});
	};

	const handleCancel = useCallback(() => {
		if (!selectedImage) {
			onCancel();
			return;
		}

		const imageElement = document.querySelector(
			// The CSS.escape() method can also be used for escaping strings
			// https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape_static
			`[data-extendify-agent-block-id="${block?.id}"] > img[src="${CSS.escape(selectedImage.url)}"]`,
		);

		if (imageElement) {
			imageElement.src = inputs.url;
		}

		onCancel();
	}, [onCancel, inputs, block, selectedImage]);

	useEffect(() => {
		if (getBlockTypes().length !== 0) return;
		registerCoreBlocks();
	}, []);

	useEffect(() => {
		// Put modal above the Agent
		const style = document.createElement('style');
		style.textContent = `.media-modal {
			z-index: 999999 !important;
		}`;
		document.head.appendChild(style);
		return () => style.remove();
	}, []);

	useEffect(() => {
		addCustomMediaViewsCss();

		return () => removeCustomMediaViewsCss();
	}, []);

	if (showConfirmation) {
		return (
			<Wrapper>
				<Confirmation
					handleConfirm={handleConfirm}
					handleCancel={handleCancel}
				/>
			</Wrapper>
		);
	}

	return (
		<Wrapper>
			<Content>
				<p className="m-0 p-0 text-sm text-gray-900">
					{sprintf(
						__(
							'The agent has requested the media library. Press "%s" to upload or select an image.',
							'extendify-local',
						),
						openButton,
					)}
				</p>
			</Content>
			<div className="flex justify-start gap-2 p-3">
				<button
					type="button"
					className="w-full rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900"
					onClick={onCancel}
				>
					{__('Cancel', 'extendify-local')}
				</button>
				<MediaUpload
					title={__('Select or Upload Image', 'extendify-local')}
					onSelect={previewImage}
					allowedTypes={['image']}
					modalClass="image__media-modal"
					render={({ open }) => (
						<button
							type="button"
							className="w-full rounded-sm border border-design-main bg-design-main p-2 text-sm text-white"
							onClick={open}
						>
							{openButton}
						</button>
					)}
				/>
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

const Confirmation = ({ handleConfirm, handleCancel }) => (
	<>
		<Content>
			<p className="m-0 p-0 text-sm text-gray-900">
				{__(
					'The agent has made the changes in the browser. Please review and confirm.',
					'extendify-local',
				)}
			</p>
		</Content>
		<div className="flex flex-wrap justify-start gap-2 p-3">
			<button
				type="button"
				className="flex-1 rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900"
				onClick={handleCancel}
			>
				{__('Cancel', 'extendify-local')}
			</button>
			<button
				type="button"
				className="flex-1 rounded-sm border border-design-main bg-design-main p-2 text-sm text-white"
				onClick={handleConfirm}
			>
				{__('Save', 'extendify-local')}
			</button>
		</div>
	</>
);
