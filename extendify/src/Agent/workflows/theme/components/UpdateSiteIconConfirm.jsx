import { ImageUploader } from '@agent/components/ImageUploader';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const updateLinkHrefAttr = (url) => {
	document.querySelectorAll('link[rel*="icon"]')?.forEach((link) => {
		link.href = url;
	});
};

export const UpdateSiteIconConfirm = ({ onConfirm, onCancel }) => {
	const [originalSiteIconUrl, setOriginalSiteIconUrl] = useState();

	useEffect(() => {
		setOriginalSiteIconUrl(
			document.querySelector('link[rel="icon"]')?.href ?? null,
		);
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

	const handleConfirm = async ({ imageId }) => {
		await onConfirm({
			data: { imageId },
			shouldRefreshPage: true,
		});
	};

	const handleCancel = () => {
		updateLinkHrefAttr(originalSiteIconUrl);
		onCancel();
	};

	const handleSelect = (image) => {
		updateLinkHrefAttr(image.url);
	};

	return (
		<Wrapper>
			<div className="relative p-3">
				<ImageUploader
					type="site_icon"
					title={__('Site icon', 'extendify-local')}
					actionLabel={__('Set site icon', 'extendify-local')}
					onSave={handleConfirm}
					onCancel={handleCancel}
					onSelect={handleSelect}
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
