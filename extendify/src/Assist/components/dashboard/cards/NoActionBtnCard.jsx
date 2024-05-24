import { DismissButton } from '@assist/components/dashboard/buttons/DismissButton';
import { useTasksStore } from '@assist/state/tasks';

export const NoActionBtnCard = ({ task }) => {
	const { isCompleted, dismissTask } = useTasksStore();
	return (
		<div
			className="flex w-full h-full bg-right-bottom bg-no-repeat bg-cover"
			style={{
				backgroundImage: `url(${task?.backgroundImage})`,
			}}>
			<div className="flex flex-col grow w-full h-full px-8 py-8 lg:mr-48 bg-white/95 lg:bg-transparent">
				<div className="md:mt-32 title text-2xl lg:text-4xl leading-10 font-semibold">
					{task.title}
				</div>
				<div className="description text-sm md:text-base mt-2">
					{task.description}
				</div>

				{!isCompleted(task.slug) && (
					<div className="mt-8 text-sm flex-wrap">
						<DismissButton
							task={task}
							variant="no-x-spacing"
							onClick={() => dismissTask(task.slug)}
						/>
					</div>
				)}
			</div>
		</div>
	);
};
