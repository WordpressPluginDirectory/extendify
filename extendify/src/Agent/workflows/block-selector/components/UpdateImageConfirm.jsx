import { walkAndUpdateImageDetails } from '@agent/lib/blocks';
import { useQuickEditStore } from '@quick-edit/state/store';
import {
	addCustomMediaViewsCss,
	removeCustomMediaViewsCss,
} from '@shared/lib/media-views';
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockTypes } from '@wordpress/blocks';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { MediaUpload } from '@wordpress/media-utils';

const openButton = __('Open Media Library', 'extendify-local');

const normalizeImageUrl = (url) => {
	if (!url) return '';
	const base = url.split('?')[0].split('#')[0];
	try {
		return decodeURIComponent(base);
	} catch {
		return base;
	}
};

// The rendered src often diverges from inputs.url — a srcset candidate, a
// re-encoded comma, or extra CDN query params — so we match on the normalized
// URL and, failing that, fall back to the sole image (a single-image block is
// unambiguous) rather than missing the swap entirely.
const findLiveImage = (blockId, url) => {
	if (!blockId) return null;
	const scope = document.querySelector(
		`[data-extendify-agent-block-id="${blockId}"]`,
	);
	if (!scope) return null;
	const images = [...scope.querySelectorAll('img')];
	if (!images.length) return null;
	const target = normalizeImageUrl(url);
	const match = images.find(
		(img) => normalizeImageUrl(img.getAttribute('src')) === target,
	);
	return match ?? (images.length === 1 ? images[0] : null);
};

export const UpdateImageConfirm = ({ inputs, onConfirm, onCancel }) => {
	const [showConfirmation, setShowConfirmation] = useState(false);
	const block = useQuickEditStore((s) => s.agentBlock);

	// The selected attachment plus the live <img> we swapped and its original
	// src/srcset, so the preview reverts to exactly what was there on cancel.
	const preview = useRef(null);

	const resetImagePreview = useCallback(() => {
		const swapped = preview.current;
		if (!swapped?.el) return;
		swapped.el.src = swapped.src;
		if (swapped.srcset) {
			swapped.el.srcset = swapped.srcset;
		} else {
			swapped.el.removeAttribute('srcset');
		}
	}, []);

	const confirmed = useRef(false);
	useEffect(
		() => () => {
			if (!confirmed.current) resetImagePreview();
		},
		[resetImagePreview],
	);

	const previewImage = (image) => {
		const liveImage = findLiveImage(block?.id, inputs.url);
		preview.current = {
			image,
			el: liveImage,
			src: liveImage?.getAttribute('src') ?? '',
			srcset: liveImage?.getAttribute('srcset') ?? '',
		};
		if (liveImage) {
			liveImage.srcset = '';
			liveImage.src = image.url;
		}
		// Advance as soon as an image is chosen. The picker's single click
		// auto-confirms (the frame closes itself), and QuickEdit's QE_INTERIOR
		// guard keeps that click from canceling the workflow — so the frame is
		// torn down cleanly before this unmounts the picker. The live swap is
		// best-effort; the real change is applied server-side on confirm.
		setShowConfirmation(true);
	};

	const handleConfirm = async () => {
		const image = preview.current?.image;
		if (!image) return;
		confirmed.current = true;
		await onConfirm({
			data: {
				previousContent: inputs.previousContent,
				newContent: walkAndUpdateImageDetails(inputs, image),
			},
			shouldRefreshPage: true,
		});
	};

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
				<Confirmation handleConfirm={handleConfirm} handleCancel={onCancel} />
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
