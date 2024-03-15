import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, close } from '@wordpress/icons';
import { arrow } from '@help-center/components/ai-chat/icons';
import { useAIChatStore } from '@help-center/state/ai-chat';

export const History = ({ setShowHistory }) => {
	const { history, setCurrentQuestion, deleteFromHistory } = useAIChatStore();

	useEffect(() => {
		if (history.length > 0) return;
		// They cleared all the history
		setTimeout(() => setShowHistory(false), 750);
	}, [history, setShowHistory]);

	return (
		<div className="relative h-full">
			<div className="flex p-4 px-6 justify-between items-center bg-gray-100 text-gray-900">
				<h1 className="m-0 p-0 text-sm font-medium">
					{__('Chat History', 'extendify-local')}
				</h1>
				<button
					type="button"
					onClick={() => setShowHistory(false)}
					className="text-design-text fill-current cursor-pointer m-0 p-0 border-0 bg-transparent">
					<Icon icon={close} size={16} />
					<span className="sr-only">
						{__('Close history', 'extendify-local')}
					</span>
				</button>
			</div>
			<ul className="m-0 p-0 mt-3 h-full overflow-y-auto">
				{[...history]
					.sort((a, b) => a.time - b.time)
					.map((item) => (
						<li key={item.answerId} className="group px-2 pr-4 flex gap-1">
							<button
								type="button"
								onClick={() => deleteFromHistory(item)}
								className="bg-transparent border-0 p-0 m-0 group-hover:opacity-100 opacity-0 cursor-pointer">
								<Icon icon={close} size={12} />
								<span className="sr-only">
									{__('Remove from history', 'extendify-local')}
								</span>
							</button>
							<button
								type="button"
								className="rounded-md border border-gray-200 w-full text-left m-0 p-2.5 bg-transparent flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100"
								onClick={() => setCurrentQuestion(item)}>
								<div>
									<span className="text-ellipsis overflow-hidden truncate">
										{item.question.substring(0, 100)}
									</span>
								</div>
								<span>
									<Icon className="fill-current text-gray-900" icon={arrow} />
								</span>
							</button>
						</li>
					))}
			</ul>
		</div>
	);
};
