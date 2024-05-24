import { useTasksStore } from '@assist/state/tasks';

export const DemoCard = ({ task }) => {
	const { completeTask, isCompleted } = useTasksStore();
	return (
		<div
			className="flex w-full h-full bg-right-bottom bg-no-repeat bg-cover"
			style={{
				backgroundImage: `url(${task?.backgroundImage})`,
			}}>
			<div className="flex flex-col grow w-full h-full px-8 py-8 lg:mr-20 text-white bg-black/10 lg:bg-transparent">
				<div className="md:mt-32 title text-2xl md:text-4xl md:leading-10 font-semibold">
					{task.title}
				</div>
				<div className="description text-sm md:text-base mt-2 lg:mr-16">
					{task.description}
				</div>
				<div className="cta flex items-center mt-8 md:gap-3 text-sm flex-wrap">
					<a
						target="_blank"
						className="text-center no-underline md:block px-4 py-2.5 cursor-pointer text-sm	font-medium	bg-design-main text-design-text rounded-sm hover:opacity-90"
						href={task.link}
						onClick={() => completeTask(task.slug)}
						rel="noreferrer">
						{isCompleted(task.slug)
							? task.buttonLabels.completed
							: task.buttonLabels.notCompleted}
					</a>
				</div>
			</div>
		</div>
	);
};
