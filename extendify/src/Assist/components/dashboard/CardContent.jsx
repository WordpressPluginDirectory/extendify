import { useRef } from '@wordpress/element';
import { LaunchCard } from '@assist/components/dashboard/LaunchCard';
import { ActionButton } from '@assist/components/dashboard/buttons/ActionButton';
import { DismissButton } from '@assist/components/dashboard/buttons/DismissButton';
import { DemoCard } from '@assist/components/dashboard/cards/DemoCard';
import { NoActionBtnCard } from '@assist/components/dashboard/cards/NoActionBtnCard';
import { DomainCard } from '@assist/components/dashboard/domains/DomainCard';
import { SecondaryDomainCard } from '@assist/components/dashboard/domains/SecondaryDomainCard';
import { useTours } from '@assist/hooks/useTours';
import { useTasksStore } from '@assist/state/tasks';

export const CardContent = ({ task }) => {
	if (task.type === 'domain-task') return <DomainCard task={task} />;

	if (task.type === 'secondary-domain-task')
		return <SecondaryDomainCard task={task} />;

	if (task.type === 'site-launcher-task') return <LaunchCard task={task} />;

	if (task.type === 'demo-card') return <DemoCard task={task} />;
	if (task.type === 'no-action-btn-card')
		return <NoActionBtnCard task={task} />;

	return <TaskContent task={task} />;
};

const TaskContent = ({ task }) => {
	const { isCompleted, dismissTask } = useTasksStore();
	const { finishedTour } = useTours();
	const isCompletedTask = isCompleted(task.slug) || finishedTour(task.slug);
	// lock state on internal Link buttons if task is not completed
	const lockedState = useRef(
		task.type === 'internalLink' && !isCompletedTask ? task : null,
	);
	const handleDismiss = () => {
		lockedState.current = null;
		dismissTask(task.slug);
	};
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

				<div className="cta flex items-center mt-8 md:gap-3 text-sm flex-wrap">
					<ActionButton task={lockedState.current ?? task} />
					{lockedState.current || !isCompletedTask ? (
						<DismissButton task={task} onClick={handleDismiss} />
					) : null}
				</div>
			</div>
		</div>
	);
};
