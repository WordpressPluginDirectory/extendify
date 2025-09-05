import { __ } from '@wordpress/i18n';
import { ChatSuggestions } from '@agent/components/ChatSuggestions';

const launchCompletedAt = window.extSharedData.launchCompletedAt;
let been24Hours = false;
try {
	const completedAt = new Date(launchCompletedAt);
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	been24Hours = completedAt < yesterday;
} catch (error) {
	// Launch wasn't completed, so still false
}

export const WelcomeScreen = () => {
	return (
		<div className="relative flex h-full flex-col border-t border-solid border-gray-300">
			<div className="relative mx-2 flex flex-grow items-end overflow-y-auto overflow-x-hidden px-2 text-gray-900">
				<div className="flex flex-col gap-1">
					{been24Hours ? null : (
						<div className="text-2xl font-semibold text-gray-700">
							{__('Site is live!', 'extendify-local')} 🎉
						</div>
					)}
					<div className="mb-2 text-2xl font-semibold">
						{__('Your expert AI team is here', 'extendify-local')}
					</div>
					<div className="text-md text-base text-gray-900">
						{__(
							'Your team of site experts — designers, developers, and marketers — ready to help from content to layouts. Tell us what you need or pick a task to start.',
							'extendify-local',
						)}
					</div>
				</div>
			</div>
			<div className="relative my-2 flex flex-col gap-0.5 p-2">
				<ChatSuggestions />
			</div>
		</div>
	);
};
