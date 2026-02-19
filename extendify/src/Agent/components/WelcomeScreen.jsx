import { ChatSuggestions } from '@agent/components/ChatSuggestions';
import { __ } from '@wordpress/i18n';

const launchCompletedAt = window.extSharedData.launchCompletedAt;
let been24Hours = false;
try {
	const completedAt = new Date(launchCompletedAt);
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	been24Hours = completedAt < yesterday;
} catch (_error) {
	// Launch wasn't completed, so still false
}

const { suggestions } = window.extAgentData;

const hasSiteVibes = suggestions.some(
	(s) => s.workflowId === 'change-site-vibes' && s?.feature,
);

const fixedList = [
	'change-theme-variation',
	hasSiteVibes ? 'change-site-vibes' : 'edit-wp-setting',
	'change-theme-fonts-variation',
];

const fixed = fixedList
	.map((id) => suggestions.find((s) => s.workflowId === id && s?.feature))
	.filter(Boolean);

export const WelcomeScreen = () => {
	return (
		<div className="relative mx-2 px-2 text-gray-900">
			{been24Hours ? null : (
				<div className="text-2xl font-semibold text-gray-700">
					{__('Site is live!', 'extendify-local')} 🎉
				</div>
			)}
			<div className="mb-2 text-2xl font-semibold">
				{__('Your expert AI team is here', 'extendify-local')}
			</div>
			<div className="text-base text-base text-gray-900">
				{__(
					'Your team of site experts — designers, developers, and marketers — ready to help from content to layouts. Tell us what you need or pick a task to start.',
					'extendify-local',
				)}
			</div>
			<div className="relative my-2 flex flex-col gap-0.5 p-2">
				<ChatSuggestions suggestions={fixed} />
			</div>
		</div>
	);
};
