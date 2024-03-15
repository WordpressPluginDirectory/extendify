import { chevronUp, Icon } from '@wordpress/icons';
import { Disclosure } from '@headlessui/react';
import classNames from 'classnames';
import { CardContent } from '@assist/components/dashboard/CardContent';
import { CardsTitle } from '@assist/components/dashboard/CardsTitle';

export const MobileCards = ({ className, totalCompleted, tasks }) => {
	return (
		<>
			<div
				className={classNames(
					className,
					'w-full border border-gray-300 bg-white overflow-auto rounded mb-6 h-full',
				)}>
				<CardsTitle totalCompleted={totalCompleted} total={tasks.length} />

				{tasks.map((task) => (
					<Disclosure key={task.slug}>
						{({ open }) => (
							<>
								<Disclosure.Button
									as="div"
									className={classNames(
										'w-full flex items-center border-b text-base',
										{
											'border-transparent': open,
											'border-gray-400': !open,
										},
									)}>
									<div className="group hover:bg-gray-100 hover:cursor-pointer flex items-center justify-between w-full md:border md:border-gray-100 py-4 px-5 lg:px-6">
										<div className="flex items-center space-x-2 w-full">
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
				))}
			</div>
		</>
	);
};
