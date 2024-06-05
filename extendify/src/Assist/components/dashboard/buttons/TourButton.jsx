import { __ } from '@wordpress/i18n';

export const TourButton = ({ task, completed }) => {
	const startTour = (slug) =>
		window.dispatchEvent(
			new CustomEvent('extendify-assist:start-tour', {
				detail: { tourSlug: slug },
			}),
		);

	return (
		<div className="">
			<button
				type="button"
				className="hidden md:block min-w-24 px-4 py-2.5 cursor-pointer text-sm	font-medium	bg-design-main text-design-text rounded-sm hover:opacity-90"
				onClick={() => startTour(task.slug)}>
				{completed
					? task.buttonLabels.completed
					: task.buttonLabels.notCompleted}
			</button>
			<div className="sm:block md:hidden rounded-sm border py-2 px-2 bg-gray-100 text-gray-700">
				{__(
					'This tour is only available on desktop devices',
					'extendify-local',
				)}
			</div>
		</div>
	);
};
