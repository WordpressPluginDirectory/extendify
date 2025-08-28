import domReady from '@wordpress/dom-ready';
import '@shared/app.css';
import { preFetchImages as preFetchUnsplashImages } from '@shared/lib/unsplash';

const isOnLaunch = () => {
	const query = new URLSearchParams(window.location.search);
	return query.get('page') === 'extendify-launch';
};

domReady(() => {
	if (isOnLaunch()) return;

	preFetchUnsplashImages();

	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has('extendify-launch-success')) {
		const currentUrl = new URL(window.location.href);
		// Remove the query param so it doesn't show again
		urlParams.delete('extendify-launch-success');
		const newUrl = `${currentUrl.origin}${currentUrl.pathname}`;
		window.history.replaceState({}, '', newUrl);
		// Trigger an event other features can listen to
		// Give time for others to add listeners
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.dispatchEvent(new CustomEvent('extendify-launch-success'));
			});
		});
	}
});
