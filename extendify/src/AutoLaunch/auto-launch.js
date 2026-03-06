import { LaunchPage } from '@auto-launch/LaunchPage';
import { createRoot } from '@wordpress/element';
import '@auto-launch/auto-launch.css';

requestAnimationFrame(() => {
	const launch = document.getElementById('extendify-auto-launch-page');
	if (!launch) return;
	const root = createRoot(launch);
	root.render(<LaunchPage />);
});
