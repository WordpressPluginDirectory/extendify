import { Tooltip } from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';
import { Icon, pencil, styles, lifesaver } from '@wordpress/icons';
import ReactMarkdown from 'react-markdown';
import { AnimateChunks } from '@agent/components/messages/AnimateChunks';
import { magic } from '@agent/icons';
import tours from '@agent/tours/tours';
import { SingleTour } from '@agent/workflows/misc/components/ToursList';

const availableTours = Object.values(tours);

const agentSuggestions = {
	'edit.php?post_type=post': {
		label: __('Take me there', 'extendify-local'),
		tour: null,
	},
	'edit.php?post_type=page': {
		label: __('Take me there', 'extendify-local'),
		tour: null,
	},
	'upload.php': {
		label: __('Take me there', 'extendify-local'),
		tour: null,
	},
	'options-general.php': {
		label: __('Take me there', 'extendify-local'),
		tour: null,
	},
	'plugins.php': {
		label: __('Take me there', 'extendify-local'),
		tour: availableTours.find((tour) => tour.id === 'plugin-management-tour'),
	},
	'themes.php': {
		label: __('Take me there', 'extendify-local'),
		tour: null,
	},
	'users.php': {
		label: __('Take me there', 'extendify-local'),
		tour: availableTours.find((tour) => tour.id === 'users-screen-tour'),
	},
	'site-editor.php': {
		label: __('Take me there', 'extendify-local'),
		tour: null,
	},
};

const agentIcons = {
	agent1: lifesaver,
	agent2: styles,
	agent3: pencil,
};

export const AgentMessage = ({ message, animate }) => {
	const { content, role, pageSuggestion, agent } = message.details;
	const containsCodeBlock = /```[\s\S]*?```/.test(content);
	const blocks = containsCodeBlock
		? [decodeEntities(content)]
		: decodeEntities(content).split(/\n{2,}/);

	// Check if the pageSuggestion matches any key in agentSuggestions
	const agentSuggestionKey = Object.keys(agentSuggestions).find((k) =>
		pageSuggestion?.startsWith(k),
	);
	const agentSuggestion = agentSuggestions[agentSuggestionKey] || {};

	return (
		<div
			data-agent-message-role={role}
			className="flex w-full items-start gap-2.5 p-2">
			<div className="w-7 flex-shrink-0">
				<Tooltip
					text={agent?.name ?? __('Agent', 'extendify-local')}
					placement="top">
					{agent?.avatar ? (
						<img className="mt-px" src={agent.avatar} alt={agent.name} />
					) : (
						<Icon
							className="-mt-0.5 fill-gray-900"
							icon={agentIcons[agent?.id] ?? magic}
							size={28}
						/>
					)}
				</Tooltip>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-4">
				<div className="extendify-agent-markdown w-full">
					{animate ? (
						<AnimateChunks words={blocks} delay={0.1} duration={0.35} />
					) : (
						<ReactMarkdown>{decodeEntities(content)}</ReactMarkdown>
					)}
				</div>
				{agentSuggestion?.label ? (
					<div>
						<a
							href={`${window.extSharedData.adminUrl}${pageSuggestion}`}
							className="rounded border border-design-main bg-design-main p-2 text-sm text-white no-underline hover:opacity-90">
							{agentSuggestion.label}
						</a>
					</div>
				) : null}
				{agentSuggestion?.tour && (
					<div>
						<SingleTour tour={agentSuggestion.tour} />
					</div>
				)}
			</div>
		</div>
	);
};
