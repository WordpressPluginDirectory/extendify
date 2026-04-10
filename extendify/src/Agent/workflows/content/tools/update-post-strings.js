import apiFetch from '@wordpress/api-fetch';

// TODO: check for post_lock and error that someone is editing
export default async ({ postId, postType, replacements }) => {
	const type = postType === 'page' ? 'pages' : 'posts';
	const response = await apiFetch({
		path: `/wp/v2/${type}/${postId}?context=edit`,
	});
	let content = response.content.raw;
	let title = response.title.raw;
	const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	for (const { original, updated } of replacements) {
		const regex = new RegExp(escapeRegExp(original), 'g');
		content = content.replace(regex, updated);
		title = title.split(original).join(updated);
	}

	const postResult = await apiFetch({
		path: `/wp/v2/${type}/${postId}`,
		method: 'POST',
		data: { content, title },
	});

	// Also update any active template parts
	const slugs = [
		...new Set(
			[...document.querySelectorAll('[data-extendify-part-slug]')].map(
				(el) => el.dataset.extendifyPartSlug,
			),
		),
	];

	if (slugs.length > 0) {
		try {
			const allParts = await apiFetch({
				path: '/wp/v2/template-parts?per_page=100&context=edit',
			});
			const activeParts = allParts.filter((p) => slugs.includes(p.slug));
			for (const part of activeParts) {
				let partContent = part.content.raw;
				let changed = false;
				for (const { original, updated } of replacements) {
					const regex = new RegExp(escapeRegExp(original), 'g');
					if (regex.test(partContent)) {
						partContent = partContent.replace(regex, updated);
						changed = true;
					}
				}
				if (changed) {
					await apiFetch({
						path: `/wp/v2/template-parts/${part.id}`,
						method: 'POST',
						data: { content: partContent },
					});
				}
			}
		} catch {
			// Template parts API may not be available, continue
		}
	}

	return postResult;
};
