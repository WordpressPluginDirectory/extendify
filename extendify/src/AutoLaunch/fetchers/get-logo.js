import { getLogoShape } from '@auto-launch/fetchers/shape';
import {
	failWithFallback,
	fetchWithTimeout,
	retryTwice,
	setStatus,
} from '@auto-launch/functions/helpers';
import { updateOption } from '@auto-launch/functions/wp';
import { AI_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';
import { resizeImage } from '@shared/utils/resize-image';
import { __ } from '@wordpress/i18n';
import { uploadMedia } from '@wordpress/media-utils';

const { showAILogo } = window.extSharedData;
const fallback = {
	logoUrl:
		'https://images.extendify-cdn.com/demo-content/logos/ext-custom-logo-default.webp',
};
const url = `${AI_HOST}/api/site-profile/generate-logo`;
const method = 'POST';
const headers = { 'Content-Type': 'application/json' };

export const handleSiteLogo = async ({ siteProfile }) => {
	if (!showAILogo) return fallback;

	// translators: this is for a action log UI. Keep it short
	setStatus(__('Generating a logo', 'extendify-local'));

	const { logoObjectName: objectName } = siteProfile;
	const body = JSON.stringify({ ...reqDataBasics, objectName });
	const response = await retryTwice(() =>
		fetchWithTimeout(url, { method, headers, body }),
	);

	if (!response?.ok) return fallback;

	const logoUrl = await failWithFallback(async () => {
		const { logoUrl } = getLogoShape.parse(await response.json());
		return await resizeImage(logoUrl, {
			size: { width: 256, height: 256 },
			mimeType: 'image/webp',
		});
	}, fallback.logoUrl);

	// If this errors we just move on.
	await uploadLogo(logoUrl);

	return getLogoShape.parse({ logoUrl });
};

const uploadLogo = async (url) => {
	const blob = await (await fetch(url)).blob();
	const type = blob.type;
	const fileExtension = type.replace('image/', '');
	const logoName = `ext-custom-logo-${Date.now()}`;
	const image = new File([blob], `${logoName}.${fileExtension}`, { type });

	await uploadMedia({
		filesList: [image],
		onFileChange: async ([fileObj]) => {
			if (!fileObj?.id) return;
			await updateOption('site_logo', fileObj.id);
		},
		onError: console.error,
	});
};
