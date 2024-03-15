import apiFetch from '@wordpress/api-fetch';

export const updateUserMeta = (option, value) =>
	apiFetch({
		path: '/extendify/v1/shared/update-user-meta',
		method: 'POST',
		data: { option, value },
	});

export const loadImage = (img) => {
	return new Promise((resolve, reject) => {
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(e);
	});
};

export const importImage = async (imageUrl, metadata = {}) => {
	const image = new Image();
	image.src = imageUrl;
	image.crossOrigin = 'anonymous';
	await loadImage(image);

	const canvas = document.createElement('canvas');
	canvas.width = image.width;
	canvas.height = image.height;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.drawImage(image, 0, 0);

	const blob = await new Promise((resolve) => {
		canvas.toBlob((blob) => {
			blob && resolve(blob);
		}, 'image/jpeg');
	});

	const formData = new FormData();
	formData.append('file', new File([blob], metadata.filename));
	formData.append('alt_text', metadata.alt ?? '');
	formData.append('caption', metadata.caption ?? '');
	formData.append('status', 'publish');

	return await apiFetch({
		path: 'wp/v2/media',
		method: 'POST',
		body: formData,
	});
};

export const importImageServer = async (src, metadata = {}) => {
	const formData = new FormData();
	formData.append('source', src);
	// Fallback doesn't suppport custom file_name
	formData.append('alt_text', metadata.alt ?? '');
	formData.append('caption', metadata.caption ?? '');

	return await apiFetch({
		path: '/extendify/v1/draft/upload-image',
		method: 'POST',
		body: formData,
	});
};
