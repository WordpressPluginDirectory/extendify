import { Icon, check } from '@wordpress/icons';
import { Tab } from '@headlessui/react';
import classNames from 'classnames';
import { CardContent } from '@assist/components/dashboard/CardContent';
import { CardsTitle } from '@assist/components/dashboard/CardsTitle';
import { useTours } from '@assist/hooks/useTours';
import { useTasksStore } from '@assist/state/tasks';
import { Bullet } from '@assist/svg';

export const DesktopCards = ({ className, tasks, totalCompleted }) => {
	const { isCompleted } = useTasksStore();
	const { finishedTour } = useTours();

	return (
		<div
			data-test="assist-tasks-module"
			className={classNames(
				className,
				'w-full border border-gray-300 text-base bg-white rounded mb-6 h-full',
			)}>
			{tasks && (
				<Tab.Group
					vertical
					as="div"
					className="flex flex-row-reverse grow min-h-96 h-[472px] justify-between">
					<Tab.List
						as="div"
						className="w-96 border-l border-gray-100 overflow-auto">
						<CardsTitle totalCompleted={totalCompleted} total={tasks.length} />

						{tasks.map((task) => (
							<TabItem
								key={task.slug}
								task={task}
								isCompleted={
									task.type === 'tour'
										? finishedTour(task.slug) || isCompleted(task.slug)
										: isCompleted(task.slug)
								}
							/>
						))}
					</Tab.List>

					<Tab.Panels as="div" className="w-3/4">
						{tasks.map((task) => (
							<Tab.Panel
								key={task.slug}
								as="div"
								data-test="assist-task-card-wrapper"
								className="h-full">
								<CardContent task={task} />
							</Tab.Panel>
						))}
					</Tab.Panels>
				</Tab.Group>
			)}
		</div>
	);
};

const TabItem = ({ task, isCompleted }) => (
	<Tab as="div" data-test={`assist-task-${task.slug}`}>
		{({ selected }) => (
			<div
				className={classNames(
					'group hover:bg-gray-100 hover:cursor-pointer flex items-center justify-between w-full border-b border-gray-300 py-4 pl-2 pr-4 text-sm',
					{
						'bg-gray-100': selected,
					},
				)}>
				<div className="flex items-center w-full">
					<Icon
						icon={isCompleted ? check : Bullet}
						size={isCompleted ? 24 : 12}
						data-test={
							isCompleted ? 'completed-task-icon' : 'uncompleted-task-icon'
						}
						className={classNames({
							'text-design-main fill-current': selected || isCompleted,
							'mx-2 text-center text-gray-400': !isCompleted && !selected,
							'mx-2': !isCompleted && selected,
						})}
					/>
					<span>{task.title}</span>
				</div>
			</div>
		)}
	</Tab>
);
