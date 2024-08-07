import { serialize, pasteHandler } from '@wordpress/blocks';
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/icons';
import classNames from 'classnames';
import { Error } from '@help-center/components/ai-chat/Error';
import { Rating } from '@help-center/components/ai-chat/Rating';
import { robot, send } from '@help-center/components/ai-chat/icons';
import { useAIChatStore } from '@help-center/state/ai-chat';

export const Answer = ({ question, answer, reset, error, answerId }) => {
	const scrollRef = useRef(null);
	const { addHistory, setCurrentQuestion } = useAIChatStore();

	// check https://github.com/extendify/extendify-sdk/issues/1560
	const parsedAnswer = pasteHandler({
		plainText: answer?.replace(/[\r\n]+/g, '<br />') ?? '',
	});
	const htmlAnswer = Array.isArray(parsedAnswer)
		? serialize(parsedAnswer)
		: parsedAnswer;

	useEffect(() => {
		if (!answerId) return;
		const newQuestion = { answerId, htmlAnswer, question, time: Date.now() };
		addHistory(newQuestion);
		setCurrentQuestion(newQuestion);
	}, [answerId, htmlAnswer, addHistory, question, setCurrentQuestion]);

	if (error) {
		return (
			<div className="p-6 pb-10 overflow-y-auto" ref={scrollRef}>
				<div className="flex justify-end mb-8 ml-4 relative">
					<Error
						text={__(
							'Oops! We were unable to send your question.',
							'extendify-local',
						)}
						reset={reset}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			<div className="p-6 pb-10 flex-grow overflow-y-auto" ref={scrollRef}>
				<div className="flex justify-end mb-8 ml-4 relative">
					<div className="m-0 p-5 rounded-lg bg-gray-800 text-design-text text-sm">
						{question}
					</div>
				</div>
				<div className="relative">
					<div className="absolute z-10 -mt-4 -ml-2 rounded-full bg-design-main p-2 flex items-center">
						<Icon
							icon={robot}
							className="text-design-text fill-current w-4 h-4"
						/>
					</div>
					<div
						className={classNames(
							'm-0 p-5 rounded-lg bg-gray-100 inline-block text-gray-800 text-sm',
							{
								'animate-pulse bg-gray-300': answer === '...',
								'bg-gray-100': answer !== '...',
							},
						)}
						dangerouslySetInnerHTML={{
							__html: htmlAnswer,
						}}
					/>
					{answerId && <Rating answerId={answerId} />}
				</div>
			</div>
			<div className="ask-another-question p-4 relative flex justify-center">
				<button
					type="button"
					onClick={reset}
					className="bg-design-main text-design-text border-none py-2 px-4 rounded-sm cursor-pointer text-sm flex items-center gap-2">
					{__('Ask Another Question', 'extendify-local')}
					<Icon icon={send} className="text-design-text fill-current h-6" />
				</button>
			</div>
		</div>
	);
};
