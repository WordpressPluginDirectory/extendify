import { __ } from '@wordpress/i18n';
import { Icon, chevronRight } from '@wordpress/icons';
import classNames from 'classnames';
import {
	playIcon,
	restartIcon,
	toursIcon,
} from '@help-center/components/tours/icons';
import { useGlobalSyncStore } from '@help-center/state/globals-sync';
import { useTourStore } from '@help-center/state/tours';
import tours from '@help-center/tours/tours';

export const ToursDashboard = ({ onOpen, classes }) => {
	const { startTour } = useTourStore();
	const { setVisibility } = useGlobalSyncStore();
	const availableTours = Object.values(tours).filter(
		(tour) =>
			tour.settings.startFrom.includes(window.location.href) ||
			!tour.settings.startFrom,
	);
	return (
		<section className={classes} data-test="help-center-tours-section">
			<button
				data-test="help-center-tours-open-button"
				type="button"
				onClick={onOpen}
				className={classNames(
					'rounded-md border border-gray-200 w-full text-left m-0 p-2.5 bg-transparent flex justify-between gap-2 cursor-pointer hover:bg-gray-100',
					{
						'rounded-b-none': availableTours.length > 0,
					},
				)}>
				<Icon
					icon={toursIcon}
					className="p-2 bg-design-main fill-design-text border-0 rounded-full"
					size={48}
				/>
				<div className="grow pl-1">
					<h1 className="m-0 p-0 text-lg font-medium">
						{__('Tours', 'extendify-local')}
					</h1>
					<p className="m-0 p-0 text-xs text-gray-800">
						{__('Learn more about your WordPress admin', 'extendify-local')}
					</p>
				</div>
				<div className="flex justify-between items-center h-12 grow-0">
					<Icon
						icon={chevronRight}
						size={24}
						className="fill-current text-gray-700"
					/>
				</div>
			</button>
			{availableTours.length > 0 && (
				<button
					type="button"
					className="rounded-md border border-t-0 border-gray-200 rounded-t-none w-full bg-transparent text-gray-900 hover:bg-gray-100 cursor-pointer p-3 text-md font-medium m-0 px-4 text-left justify-between items-center flex gap-2 pl-[4.25rem]"
					onClick={() => {
						setVisibility('minimized');
						startTour(availableTours[0]);
					}}>
					{__('Tour this page', 'extendify-local')}
					<Icon icon={playIcon} size={16} />
				</button>
			)}
		</section>
	);
};

export const Tours = () => {
	const { wasCompleted, startTour } = useTourStore();
	const { setVisibility } = useGlobalSyncStore();
	return (
		<section className="p-4">
			<ul
				className="m-0 p-0 flex flex-col gap-2"
				data-test="help-center-tours-items-list">
				{Object.values(tours).map((tourData) => {
					const { id, title } = tourData;
					return (
						<li key={id} className="m-0 p-0">
							<button
								type="button"
								className="text-sm font-medium m-0 py-3.5 px-4 w-full bg-gray-100 text-gray-900 hover:bg-gray-150 cursor-pointer flex gap-2 justify-between items-center"
								onClick={() => {
									setVisibility('minimized');
									startTour(tourData);
								}}>
								{title}
								{wasCompleted(id) ? (
									<Icon
										data-test="restart-tour-icon"
										icon={restartIcon}
										size={16}
									/>
								) : (
									<Icon data-test="play-tour-icon" icon={playIcon} size={16} />
								)}
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
};

export const routes = [
	{
		slug: 'tours',
		title: __('Tours', 'extendify-local'),
		component: Tours,
	},
];
