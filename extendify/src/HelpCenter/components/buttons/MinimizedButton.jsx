import { Topbar } from '../modal/TopBar';

export const MinimizedButton = () => (
	<div
		className="shadow-2xl overflow-hidden rounded-md border border-gray-500"
		data-test="help-center-minimize-state">
		<Topbar />
	</div>
);
