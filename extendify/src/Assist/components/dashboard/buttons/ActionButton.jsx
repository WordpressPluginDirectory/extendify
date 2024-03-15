import { __ } from '@wordpress/i18n';
import { LinkButton } from '@assist/components/dashboard/buttons/LinkButton';
import { ModalButton } from '@assist/components/dashboard/buttons/ModalButton';
import { TourButton } from '@assist/components/dashboard/buttons/TourButton';
import { useTours } from '@assist/hooks/useTours';
import { useTasksStore } from '@assist/state/tasks';

export const ActionButton = ({ task }) => {
	const { isCompleted, dismissTask } = useTasksStore();
	const { finishedTour } = useTours();

	return (
		<div className="cta flex items-center mt-8 md:gap-3 text-sm flex-wrap">
			{task.type === 'modal' && (
				<ModalButton task={task} completed={isCompleted(task.slug)} />
			)}

			{task.type === 'internalLink' && (
				<LinkButton task={task} completed={isCompleted(task.slug)} />
			)}

			{task.type === 'tour' && (
				<TourButton
					task={task}
					completed={finishedTour(task.slug) || isCompleted(task.slug)}
				/>
			)}

			{!isCompleted(task.slug) && !finishedTour(task.slug) && (
				<button
					type="button"
					onClick={() => {
						dismissTask(task.slug);
					}}
					className="px-2 py-2 cursor-pointer bg-transparent text-design-main text-sm	hover:underline underline-offset-4">
					{__('Dismiss', 'extendify-local')}
				</button>
			)}
		</div>
	);
};
