import { subscribe } from '@wordpress/data';
import '@shared/app.css';
import { EditPageToolTip } from '@shared/components/EditPageToolTip';
import { render } from '@shared/lib/dom';
import { preFetchImages as preFetchUnsplashImages } from '@shared/lib/unsplash';

const isOnLaunch = () => {
	const query = new URLSearchParams(window.location.search);
	return query.get('page') === 'extendify-launch';
};

(() => {
	// Disable the page editor welcome guide always (they can manually open it)
	const key = `WP_PREFERENCES_USER_${window.extSharedData.userId}`;
	const existing = window.localStorage.getItem(key) || '{}';

	window.localStorage.setItem(
		key,
		JSON.stringify({
			...JSON.parse(existing),
			'core/edit-post': {
				...(JSON.parse(existing)?.['core/edit-post'] ?? {}),
				welcomeGuide: false,
			},
		}),
	);

	if (isOnLaunch()) return;

	preFetchUnsplashImages();

	// TODO: If this PR is released in WP (6.7?), then we can use the localstorage
	// approach that we use above for the welcome guide
	// https://github.com/WordPress/gutenberg/pull/65026

	// If the pattern modal shows up within 3 seconds, close it
	const modalClass = '.editor-start-page-options__modal-content';
	const modalCloseButton = '.components-modal__header > .components-button';
	// Add CSS to hide the modal initially (avoid content paint flash)
	const style = document.createElement('style');
	style.innerHTML =
		'.components-modal__screen-overlay { display: none!important }';
	document.head.appendChild(style);

	const unsub = subscribe(() => {
		const modal = document.querySelector(modalClass);
		if (!modal) return;
		modal.style.display = ''; // Temp show to click it
		document.querySelector(modalCloseButton)?.click();
	});
	setTimeout(() => {
		// Remove the CSS rule always
		document.head.removeChild(style);
		unsub();
	}, 3000);

	// If they just finished launch and are on the home page,
	// then show the edit page modal tooltip
	const urlParams = new URLSearchParams(window.location.search);
	const justCompletedLaunch = urlParams.has('extendify-launch-success');
	if (justCompletedLaunch) {
		const hasEditButton = document.querySelector('#wp-admin-bar-edit');
		if (!hasEditButton) return;
		const currentUrl = new URL(window.location.href);
		const homeUrl = new URL(window.extSharedData.homeUrl);
		const isHomePage =
			currentUrl.origin === homeUrl.origin &&
			currentUrl.pathname === homeUrl.pathname;
		// Remove the query param so it doesn't show again
		urlParams.delete('extendify-launch-success');
		const newUrl = `${currentUrl.origin}${currentUrl.pathname}`;
		window.history.replaceState({}, '', newUrl);
		if (isHomePage) {
			// Add a div to render on
			const div = Object.assign(document.createElement('div'), {
				id: 'extendify-edit-page-modal-tooltip',
			});
			document.body.appendChild(div);
			render(<EditPageToolTip />, div);
		}
	}
})();
