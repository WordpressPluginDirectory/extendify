import apiFetch from '@wordpress/api-fetch';

const postTypes = { page: 'pages', post: 'posts' };

export default async ({ postId, postType }) => {
	// Get all nav menus that are presented in the post/page.
	const postNavigations = Array.from(
		window.document?.querySelectorAll('nav[data-extendify-menu-id]') ?? [],
	)
		.map((nav) => nav.dataset.extendifyMenuId)
		.filter(Boolean);

	// get the data about those nav menus
	const navigations =
		(await apiFetch({
			method: 'POST',
			path: '/extendify/v1/agent/site-navigation',
			data: { only: postNavigations.join(',') },
		})) ?? [];

	const postInfo = await apiFetch({
		path: `/wp/v2/${postTypes[postType]}/${postId}`,
	});

	return {
		navigations,
		postTitle: postInfo.title.rendered,
		postURL: postInfo.link,
	};
};
