import { LaunchCard } from '@assist/components/dashboard/LaunchCard';
import { ActionButton } from '@assist/components/dashboard/buttons/ActionButton';
import { DemoCard } from '@assist/components/dashboard/demo-cards/DemoCard';
import { DomainCard } from '@assist/components/dashboard/domains/DomainCard';
import { SecondaryDomainCard } from '@assist/components/dashboard/domains/SecondaryDomainCard';

export const CardContent = ({ task }) => {
	if (task.type === 'domain-task') return <DomainCard task={task} />;

	if (task.type === 'secondary-domain-task')
		return <SecondaryDomainCard task={task} />;

	if (task.type === 'site-launcher-task') return <LaunchCard task={task} />;

	if (task.type === 'demo-card') return <DemoCard task={task} />;

	return <TaskContent task={task} />;
};

const TaskContent = ({ task }) => (
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

			<ActionButton task={task} />
		</div>
	</div>
);
