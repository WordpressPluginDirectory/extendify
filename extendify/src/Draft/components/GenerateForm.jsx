import { Button, TextareaControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useGlobalStore } from '@draft/state/global';
import { CreditCounter } from './CreditCounter';

export const GenerateForm = ({
	isGenerating,
	errorMessage,
	imagePrompt,
	setImagePrompt,
}) => {
	const { imageCredits, resetImageCredits } = useGlobalStore();
	const usedCredits = imageCredits.total - imageCredits.remaining;
	const [refreshCheck, setRefreshCheck] = useState(0);

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

	return (
		<>
			{isGenerating ? null : (
				<TextareaControl
					id="draft-ai-image-textarea"
					placeholder={__(
						'Tell AI about the image you would like to create',
						'extendify-local',
					)}
					label={__('Image Prompt', 'extendify-local')}
					hideLabelFromVision
					rows="7"
					value={imagePrompt}
					onChange={setImagePrompt}
				/>
			)}
			{errorMessage.length > 0 && (
				<p className="text-red-500 mb-0">{errorMessage}</p>
			)}
			<Button
				type="submit"
				className="w-full justify-center"
				variant="primary"
				disabled={
					isGenerating || !imagePrompt || usedCredits >= imageCredits.total
				}>
				{isGenerating
					? __('Generating image...', 'extendify-local')
					: __('Generate image', 'extendify-local')}
			</Button>
			{isGenerating ? (
				<Button
					type="submit"
					className="w-full justify-center bg-gray-200 text-gray-800">
					{__('Cancel', 'extendify-local')}
				</Button>
			) : (
				<CreditCounter usedCredits={usedCredits} total={imageCredits.total} />
			)}
		</>
	);
};
