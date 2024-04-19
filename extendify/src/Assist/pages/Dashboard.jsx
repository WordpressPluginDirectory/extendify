import classnames from 'classnames';
import { DesktopCards } from '@assist/components/dashboard/DesktopCards';
import { MobileCards } from '@assist/components/dashboard/MobileCards';
import { QuickLinks } from '@assist/components/dashboard/QuickLinks';
import { Recommendations } from '@assist/components/dashboard/Recommendations';
import { TasksCompleted } from '@assist/components/dashboard/TasksCompleted';
import { DomainBanner } from '@assist/components/dashboard/domains/DomainBanner';
import { SecondaryDomainBanner } from '@assist/components/dashboard/domains/SecondaryDomainBanner';
import { useTasks } from '@assist/hooks/useTasks';
import {
	showDomainBanner,
	showSecondaryDomainBanner,
} from '@assist/lib/domains';
import { Full } from '@assist/pages/layouts/Full';
import { useGlobalStore } from '@assist/state/globals';
import { useTasksStore } from '@assist/state/tasks';

const { devbuild, themeSlug } = window.extSharedData;
const showRecommendations =
	devbuild || !window.extAssistData.disableRecommendations || false;
const { launchCompleted } = window.extAssistData;

export const Dashboard = () => {
	const { tasks } = useTasks();
	const { isDismissedBanner } = useGlobalStore();
	const { isCompleted } = useTasksStore();
	const totalCompleted = tasks.filter((task) => isCompleted(task.slug)).length;
	const isTasksCompleted = totalCompleted === tasks.length;
	const showTasks =
		(themeSlug === 'extendable' && (!launchCompleted || launchCompleted)) ||
		(themeSlug !== 'extendable' && launchCompleted);

	return (
		<Full>
			{showDomainBanner && !isDismissedBanner('domain-banner') && (
				<DomainBanner />
			)}

			{showSecondaryDomainBanner &&
				!isDismissedBanner('secondary-domain-banner') && (
					<SecondaryDomainBanner />
				)}

			{isTasksCompleted && !isDismissedBanner('tasks-completed') && (
				<TasksCompleted />
			)}

			{showTasks && !isTasksCompleted && (
				<>
					<DesktopCards
						className="hidden md:block"
						tasks={tasks}
						totalCompleted={totalCompleted}
					/>

					<MobileCards
						className="md:hidden"
						tasks={tasks}
						totalCompleted={totalCompleted}
					/>
				</>
			)}

			<div
				className={classnames('md:grid gap-4 mb-6', {
					'md:grid-cols-2': !showRecommendations,
				})}>
				<QuickLinks className="col-span-2" />
			</div>

			{showRecommendations && <Recommendations />}
		</Full>
	);
};
