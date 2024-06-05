import { chevronUp, Icon, check } from '@wordpress/icons';
import { Disclosure } from '@headlessui/react';
import classNames from 'classnames';
import { CardContent } from '@assist/components/dashboard/CardContent';
import { CardsTitle } from '@assist/components/dashboard/CardsTitle';
import { useTasksStore } from '@assist/state/tasks';
import { Bullet } from '@assist/svg';

export const MobileCards = ({ className, totalCompleted, tasks }) => {
	const { isCompleted } = useTasksStore();

	return (
		<>
			<div
				className={classNames(
					className,
					'w-full border border-gray-300 bg-white overflow-auto rounded mb-6 h-full',
				)}>
				<CardsTitle totalCompleted={totalCompleted} total={tasks.length} />

				{tasks.map((task) => {
					const isCompletedTask = isCompleted(task.slug);
					return (
						<Disclosure key={task.slug}>
							{({ open }) => (
								<>
									<Disclosure.Button
										as="div"
										className={classNames(
											'w-full flex items-center border-b text-base',
											{
												'border-transparent font-semibold': open,
												'border-gray-400': !open,
											},
										)}>
										<div className="group hover:bg-gray-100 hover:cursor-pointer flex items-center justify-between w-full md:border md:border-gray-100 py-4 px-5 lg:px-6">
											<div className="flex items-center space-x-2 w-full">
												<Icon
													icon={isCompletedTask ? check : Bullet}
													size={isCompletedTask ? 24 : 12}
													className={classNames({
														'text-design-main fill-current': open,
														'mx-2 text-center text-gray-400':
															!isCompletedTask && !open,
														'mx-2': !isCompletedTask && open,
													})}
												/>
												{task.title}
											</div>
											<div className="md:hidden">
												<Icon
													icon={chevronUp}
													className={classNames(
														'md:hidden h-5 w-5 text-purple-500',
														{
															'rotate-180 transform': open,
														},
													)}
												/>
											</div>
										</div>
									</Disclosure.Button>

									<Disclosure.Panel className="border-gray-400 border-b">
										<CardContent task={task} />
									</Disclosure.Panel>
								</>
							)}
						</Disclosure>
					);
				})}
			</div>
		</>
	);
};
