import { __, sprintf } from '@wordpress/i18n';
import { ChatSuggestions } from '@agent/components/ChatSuggestions';
import { Rating } from '@agent/components/Rating';
import { AnimateChunks } from '@agent/components/messages/AnimateChunks';

export const WorkflowMessage = ({ message, animate }) => {
	const { agent, status, answerId, firstSeen } = message.details;
	const currentAgent = agent?.name || __('Agent X', 'extendify-local');
	const rejoined = status === 'started' && !firstSeen;

	const types = {
		// translators: %s: The name of the agent
		started: sprintf(__('%s has joined', 'extendify-local'), currentAgent),
		rejoined: sprintf(__('%s has rejoined', 'extendify-local'), currentAgent),
		// translators: %s: The name of the agent
		canceled: sprintf(__('%s has left', 'extendify-local'), currentAgent),
		completed: '',
		handoff: __('Transferred to a new agent', 'extendify-local'),
	};
	const chars = rejoined ? types.rejoined.split('') : types[status].split('');

	return (
		<div className="flex flex-col gap-px p-2 text-center text-xs italic">
			{chars?.length > 0 ? (
				<div>
					{animate ? (
						<AnimateChunks words={chars} delay={0.02} />
					) : (
						chars.join('')
					)}
				</div>
			) : null}
			{answerId && <Rating answerId={answerId} />}
			{['completed', 'canceled'].includes(status) ? (
				<div className="relative mb-4 ml-9 mr-2 mt-4 flex flex-col gap-0.5 border-t border-gray-300 p-0 pt-4 text-sm text-gray-800 rtl:ml-2 rtl:mr-9">
					<p className="m-0 mb-2 p-0 px-2 text-left text-sm not-italic text-gray-900 rtl:text-right">
						{__(
							"What's next? Would you like to do something else?",
							'extendify-local',
						)}
					</p>
					<ChatSuggestions />
				</div>
			) : null}
		</div>
	);
};
