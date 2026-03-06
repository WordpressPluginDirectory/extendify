// Functions that interact with WordPress

import blogSampleData from '@launch/_data/blog-sample.json';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';

const allowedHeaders = ['header', 'header-with-center-nav-and-social'];
const allowedFooters = [
	'footer',
	'footer-social-icons',
	'footer-with-center-logo-and-menu',
];
const allowedFootersWithNav = [
	'footer-with-nav',
	'footer-with-center-logo-social-nav',
];

export const updateOption = (option, value) =>
	apiFetch({
		path: '/extendify/v1/auto-launch/options',
		method: 'POST',
		data: { option, value },
	});
export const getOption = (option) =>
	apiFetch({
		path: addQueryArgs(`/extendify/v1/auto-launch/options`, { option }),
	});

export const getPageById = (id) => {
	try {
		return apiFetch({ path: `/wp/v2/pages/${id}` });
	} catch {
		return null;
	}
};

const getTemplateParts = () => apiFetch({ path: '/wp/v2/template-parts' });

export const getHeadersAndFooters = async (useNavFooter = false) => {
	const patterns = await getTemplateParts();
	const extendablePatterns = patterns.filter(
		({ theme }) => theme === 'extendable',
	);
	const headers = extendablePatterns?.filter(({ slug }) =>
		allowedHeaders.includes(slug),
	);

	const footerNav =
		useNavFooter &&
		patterns?.some(({ slug }) => allowedFootersWithNav.includes(slug));
	const footerSlugsToUse = footerNav ? allowedFootersWithNav : allowedFooters;

	const footers = extendablePatterns.filter(({ slug }) =>
		footerSlugsToUse.includes(slug),
	);
	return { headers, footers };
};

export const uploadMedia = (data) =>
	apiFetch({ path: 'wp/v2/media', data, method: 'POST' });

export const importImage = async (imageUrl, metadata) => {
	try {
		const loadImage = (img) => {
			return new Promise((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Failed to load image.'));
			});
		};

		const image = new Image();
		image.src = imageUrl;
		image.crossOrigin = 'anonymous';
		await loadImage(image);

		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;

		const ctx = canvas.getContext('2d');
		if (!ctx) return null; // Fail silently

		ctx.drawImage(image, 0, 0);

		const blob = await new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) resolve(blob);
				else reject(new Error('Failed to convert canvas to Blob.'));
			}, 'image/jpeg');
		});

		const formData = new FormData();
		formData.append(
			'file',
			new File([blob], metadata.filename, { type: 'image/jpeg' }),
		);
		formData.append('alt_text', metadata.alt || '');
		formData.append('caption', metadata.caption || '');
		formData.append('status', 'publish');

		return await uploadMedia(formData);
	} catch (_error) {
		// Fail silently, return null
		return null;
	}
};

export const createPost = (data) =>
	apiFetch({ path: '/wp/v2/posts', method: 'POST', data });

export const createTag = (data) =>
	apiFetch({ path: '/wp/v2/tags', method: 'POST', data });

export const createCategory = (data) =>
	apiFetch({ path: '/wp/v2/categories', method: 'POST', data });

export const createBlogSampleData = async (siteStrings, siteImages) => {
	const localizedBlogSampleData =
		blogSampleData[window.extSharedData?.wpLanguage || 'en_US'] ||
		blogSampleData.en_US;

	const categories =
		(await createWpCategories(localizedBlogSampleData.categories)) || [];
	const tags = (await createWpTags(localizedBlogSampleData.tags)) || [];
	const formatImageUrl = (image) =>
		image?.includes('?q=80&w=1470') ? image : `${image}?q=80&w=1470`;
	const imagesArray = (siteImages?.siteImages || []).sort(
		() => Math.random() - 0.5,
	);

	const replacePostContentImages = (content, images) =>
		(content.match(/https:\/\/images\.unsplash\.com\/[^\s"]+/g) || []).reduce(
			(updated, match, i) =>
				updated.replace(match, formatImageUrl(images[i] || match)),
			content,
		);

	const posts = Array.from({ length: 8 }, (_, i) => {
		const title =
			siteStrings?.aiBlogTitles?.[i] ||
			// translators: %s is a post number
			sprintf(__('Blog Post %s', 'extendify-local'), i + 1);
		const featuredImage = imagesArray[i % imagesArray.length]
			? formatImageUrl(imagesArray[i % imagesArray.length])
			: null;
		return {
			name: title,
			featured_image: featuredImage,
			post_content: replacePostContentImages(
				localizedBlogSampleData.post_content,
				imagesArray,
			),
		};
	});

	for (const [index, post] of posts.entries()) {
		try {
			const mediaId = post.featured_image
				? (
						await importImage(post.featured_image, {
							alt: '',
							filename: `featured-image-${index}.jpg`,
							caption: '',
						})
					)?.id || null
				: null;

			const category = categories.length
				? categories[index % categories.length]?.id
				: [];

			const tagFeaturedPost =
				index < 4
					? [tags.find((tag) => tag.slug === 'featured')?.id].filter(Boolean)
					: [];

			const postData = {
				title: post.name,
				content: post.post_content,
				status: 'publish',
				featured_media: mediaId || null,
				categories: category,
				tags: tagFeaturedPost,
				meta: { made_with_extendify_launch: true },
			};

			await createPost(postData);
		} catch (_error) {
			// Fail silently
		}
	}
};

export const createWpCategories = async (categories) => {
	const responses = [];
	for (const category of categories) {
		const categoryData = {
			name: category.name,
			slug: category.slug,
			description: category.description,
		};
		let newCategory;
		try {
			newCategory = await createCategory(categoryData);
		} catch (_e) {
			// Fail silently
		}
		if (newCategory?.id && newCategory?.slug) {
			responses.push({ id: newCategory.id, slug: newCategory.slug });
		}
	}
	return responses;
};

export const createWpTags = async (tags) => {
	const responses = [];
	for (const tag of tags) {
		const tagData = {
			name: tag.name,
			slug: tag.slug,
			description: tag.description,
		};
		let newTag;
		try {
			newTag = await createTag(tagData);
		} catch (_e) {
			// Fail silently
		}
		if (newTag?.id && newTag?.slug) {
			responses.push({ id: newTag.id, slug: newTag.slug });
		}
	}
	return responses;
};
