import { useLayoutEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { chevronRight, Icon, postComments } from '@wordpress/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { Answer } from '@help-center/components/ai-chat/Answer';
import { History } from '@help-center/components/ai-chat/History';
import { Nav } from '@help-center/components/ai-chat/Nav';
import { Question } from '@help-center/components/ai-chat/Question';
import { Support } from '@help-center/components/ai-chat/Support';
import { getAnswer } from '@help-center/lib/api';
import { updateUserMeta } from '@help-center/lib/wp';
import { useAIChatStore } from '@help-center/state/ai-chat';

export const AIChatDashboard = ({ onOpen }) => {
	return (
		<section className="">
			<button
				type="button"
				onClick={onOpen}
				className="rounded-md border border-gray-200 w-full text-left m-0 p-2.5 bg-transparent flex justify-between gap-2 cursor-pointer hover:bg-gray-100">
				<Icon
					icon={postComments}
					className="p-2 bg-design-main fill-design-text border-0 rounded-full"
					size={48}
				/>
				<div className="grow pl-1">
					<h1 className="m-0 p-0 text-lg font-medium">
						{__('Ask AI', 'extendify-local')}
					</h1>
					<p className="m-0 p-0 text-xs text-gray-800">
						{__('Got questions? Ask our AI chatbot', 'extendify-local')}
					</p>
				</div>
				<div className="flex justify-end items-center h-12 grow-0">
					<Icon
						icon={chevronRight}
						size={24}
						className="fill-current text-gray-700"
					/>
				</div>
			</button>
		</section>
	);
};

export const AIChat = () => {
	const [question, setQuestion] = useState(undefined);
	const [answer, setAnswer] = useState(undefined);
	const [answerId, setAnswerId] = useState(undefined);
	const [error, setError] = useState(false);

	const [showHistory, setShowHistory] = useState(false);
	const { experienceLevel, currentQuestion, setCurrentQuestion } =
		useAIChatStore();

	const showAIConsent = window.extSharedData?.showAIConsent;
	const [userGaveConsent, setUserGaveConsent] = useState(
		window.extSharedData?.userGaveConsent,
	);

	const reset = () => {
		setQuestion(undefined);
		setAnswer(undefined);
		setAnswerId(undefined);
		setError(false);
		setAnswerId(undefined);
		setShowHistory(false);
		setCurrentQuestion(undefined);
	};

	const handleSubmit = async (formSubmitEvent) => {
		formSubmitEvent.preventDefault();
		const q = formSubmitEvent.target?.[0]?.value ?? '';
		if (!q) return;
		setAnswer('...');
		setQuestion(q);
		const response = await getAnswer({ question: q, experienceLevel });
		if (!response.ok) {
			setError(true);
			return;
		}
		try {
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value);
				try {
					const { id } = JSON.parse(chunk);
					if (!id) throw new Error('False positive');
					setAnswerId(id);
				} catch (e) {
					// if chunk fails to parse then it's a string
					setAnswer((v) => {
						if (v === '...') return chunk;
						return v + chunk;
					});
				}
			}
		} catch (e) {
			console.error(e);
		}
	};

	useLayoutEffect(() => {
		setQuestion(currentQuestion?.question);
		setAnswer(currentQuestion?.htmlAnswer);
		setShowHistory(false);
	}, [currentQuestion]);

	if (showAIConsent && !userGaveConsent) {
		return (
			<ConsentOverlay
				onAccept={() => {
					updateUserMeta('ai_consent', true);
					setUserGaveConsent(true);
				}}
			/>
		);
	}

	if (question) {
		return (
			<Answer
				question={question}
				answer={answer}
				answerId={answerId}
				reset={reset}
				error={error}
			/>
		);
	}

	return (
		<>
			<section className="flex flex-col h-full">
				<Nav setShowHistory={setShowHistory} showHistory={showHistory} />
				<div className="p-6 bg-design-main text-design-text flex-grow flex items-center">
					<Question onSubmit={handleSubmit} />
				</div>
				<Support height={'h-11'} />
			</section>
			<AnimatePresence>
				{showHistory && (
					<motion.section
						// slide up from bottom 100%
						initial={{ x: 50 }}
						animate={{ x: 0 }}
						exit={{ x: 0 }}
						transition={{ duration: 0.2 }}
						style={{ '--ext-design-text': '#000000' }}
						className="flex flex-col h-full shadow-2xl ml-4 mt-4 rounded-tl-lg overflow-hidden absolute bottom-0 right-0 left-0 top-0 bg-white z-20">
						<History setShowHistory={setShowHistory} />
					</motion.section>
				)}
			</AnimatePresence>
		</>
	);
};

const ConsentOverlay = ({ onAccept }) => (
	<div className="bg-black/75 p-6 absolute inset-0 flex items-center justify-center">
		<div className="bg-white p-4 rounded">
			<h2 className="text-lg mt-0 mb-2">
				{__('Terms of Use', 'extendify-local')}
			</h2>
			<p
				className="m-0"
				dangerouslySetInnerHTML={{
					__html: window.extSharedData.consentTermsHTML,
				}}></p>
			<button
				className="mt-4 bg-design-main text-white rounded px-4 py-2 border-0 text-center w-full cursor-pointer"
				type="button"
				onClick={onAccept}>
				{__('Accept', 'extendify-local')}
			</button>
		</div>
	</div>
);

export const routes = [
	{
		slug: 'ai-chat',
		title: __('AI Chatbot', 'extendify-local'),
		component: AIChat,
	},
];
