import { ImageUploader } from '@agent/components/ImageUploader';
import { useWorkflowStore } from '@agent/state/workflows';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const updateLogoSrcAttr = (url, cssFilter) => {
	document.querySelectorAll('.wp-block-site-logo img')?.forEach((img) => {
		img.srcset = '';
		img.src = url;
		img.style.filter = cssFilter ?? '';
	});
};

export const UpdateLogoConfirm = ({ onConfirm, onCancel }) => {
	const { block } = useWorkflowStore();

	const [originalLogoImgSrc, setOriginalLogoImgSrc] = useState();

	useEffect(() => {
		setOriginalLogoImgSrc(
			document.querySelector('.wp-block-site-logo img')?.src ?? null,
		);
	}, [block]);

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
			shouldRefreshPage: !window.extAgentData?.context?.adminPage,
		});
	};

	const handleCancel = () => {
		updateLogoSrcAttr(originalLogoImgSrc);
		onCancel();
	};

	const handleSelect = (image) => {
		updateLogoSrcAttr(image.url, 'none');
	};

	return (
		<Wrapper>
			<div className="relative p-3">
				<ImageUploader
					type="site_logo"
					title={__('Site logo', 'extendify-local')}
					actionLabel={__('Set site logo', 'extendify-local')}
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
