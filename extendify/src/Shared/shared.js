import '@shared/app.css';
import { EditPageToolTip } from '@shared/components/EditPageToolTip';
import { render } from '@shared/lib/dom';
import { preFetchImages as preFetchUnsplashImages } from '@shared/lib/unsplash';

const isOnLaunch = () => {
	const query = new URLSearchParams(window.location.search);
	return query.get('page') === 'extendify-launch';
};

(() => {
	if (isOnLaunch()) return;

	preFetchUnsplashImages();

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
