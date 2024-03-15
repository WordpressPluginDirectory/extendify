import { __ } from '@wordpress/i18n';
import { useRouter } from '@help-center/hooks/useRouter';
import { AIChatDashboard } from './AIChat';
import { KnowledgeBaseDashboard } from './KnowledgeBase';
import { ToursDashboard } from './Tours';

const showChat =
	window.extHelpCenterData?.showChat || window.extSharedData?.devbuild;

export const Dashboard = () => {
	const { navigateTo } = useRouter();
	return (
		<div className="mx-auto w-full max-w-md rounded-2xl flex flex-col gap-3 p-4">
			<KnowledgeBaseDashboard onOpen={() => navigateTo('knowledge-base')} />
			<ToursDashboard
				onOpen={() => navigateTo('tours')}
				classes="hidden md:block"
			/>
			{showChat && <AIChatDashboard onOpen={() => navigateTo('ai-chat')} />}
		</div>
	);
};

export const routes = [
	{
		slug: 'dashboard',
		title: __('Help Center', 'extendify-local'),
		component: Dashboard,
	},
];
