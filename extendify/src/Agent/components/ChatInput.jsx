import { ChatTools } from '@agent/components/ChatTools';
import { cancelRequest } from '@agent/icons';
import { useGlobalStore } from '@agent/state/global';
import { useWorkflowStore } from '@agent/state/workflows';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { arrowUp, Icon } from '@wordpress/icons';
import classNames from 'classnames';

export const ChatInput = ({ disabled, handleSubmit }) => {
	const textareaRef = useRef(null);
	const [input, setInput] = useState('');
	const [history, setHistory] = useState([]);
	const dirtyRef = useRef(false);
	const [historyIndex, setHistoryIndex] = useState(null);
	const { getWorkflowsByFeature, block } = useWorkflowStore();
	const { isMobile } = useGlobalStore();
	const domTool =
		getWorkflowsByFeature({ requires: ['block'] })?.length > 0 && !isMobile;
	const INPUT_LIMIT = 1500;
	const inputTrimmed = input.trim();
	const overLimit = inputTrimmed.length > INPUT_LIMIT;

	// resize the height of the textarea based on the content
	const adjustHeight = useCallback(() => {
		if (!textareaRef.current) return;
		textareaRef.current.style.height = 'auto';
		const chat =
			textareaRef.current.closest('#extendify-agent-chat').offsetHeight * 0.55;
		const h = Math.min(chat, textareaRef.current.scrollHeight);
		textareaRef.current.style.height = `${block && h < 60 ? 60 : h}px`;
	}, [block]);

	useLayoutEffect(() => {
		window.addEventListener('extendify-agent:resize-end', adjustHeight);
		adjustHeight();
		return () =>
			window.removeEventListener('extendify-agent:resize-end', adjustHeight);
	}, [adjustHeight]);

	useEffect(() => {
		const watchForSubmit = ({ detail }) => {
			setHistory((prev) => {
				// avoid duplicates
				if (prev?.at(-1) === detail.message) return prev;
				return [...prev, detail.message];
			});
			setHistoryIndex(null);
		};
		window.addEventListener('extendify-agent:chat-submit', watchForSubmit);
		return () =>
			window.removeEventListener('extendify-agent:chat-submit', watchForSubmit);
	}, []);

	useEffect(() => {
		adjustHeight();
	}, [input, adjustHeight]);

	useEffect(() => {
		const userMessages = Array.from(
			document.querySelectorAll(
				'#extendify-agent-chat-scroll-area > [data-agent-message-role="user"]',
			),
		)?.map((el) => el.textContent || '');
		const deduped = userMessages.filter(
			(msg, i, arr) => i === 0 || msg !== arr[i - 1],
		);
		setHistory(deduped);
	}, []);

	const submitForm = useCallback(
		(e) => {
			e?.preventDefault();
			if (!input.trim() || overLimit) return;
			handleSubmit(input.trim());
			setHistory((prev) => {
				// avoid duplicates
				if (prev?.at(-1) === input) return prev;
				return [...prev, input];
			});
			setHistoryIndex(null);
			setInput('');
			requestAnimationFrame(() => {
				dirtyRef.current = false;
				adjustHeight();
				textareaRef.current?.focus();
			});
		},
		[input, handleSubmit, adjustHeight, overLimit],
	);

	const handleKeyDown = useCallback(
		(event) => {
			if (
				event.key === 'Enter' &&
				!event.shiftKey &&
				!event.nativeEvent.isComposing
			) {
				event.preventDefault();
				if (!overLimit) submitForm();
				return;
			}
			if (dirtyRef.current) return;
			if (event.key === 'ArrowUp') {
				if (!history.length) return;
				if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
					return;
				setHistoryIndex((prev) => {
					const next =
						prev === null ? history.length - 1 : Math.max(prev - 1, 0);
					setInput(history[next]);
					return next;
				});
				event.preventDefault();
				return;
			}
			if (event.key === 'ArrowDown') {
				if (historyIndex === null) return;
				if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
					return;
				setHistoryIndex((prev) => {
					if (prev === null) return null;
					const next = prev + 1;
					if (next >= history.length) {
						setInput('');
						return null;
					}
					setInput(history[next]);
					return next;
				});
				event.preventDefault();
				return;
			}
			dirtyRef.current = true;
		},
		[history, historyIndex, submitForm, overLimit],
	);

	const handleCancel = useCallback((e) => {
		e.stopPropagation();
		window.dispatchEvent(new CustomEvent('extendify-agent:cancel-workflow'));
	}, []);

	return (
		// biome-ignore lint: allow onClick without keyboard
		<form
			onSubmit={submitForm}
			onClick={() => textareaRef.current?.focus()}
			className={classNames(
				'relative flex w-full flex-col rounded-sm border border-gray-300 focus-within:outline-design-main focus:rounded-sm focus:border-design-main focus:ring-design-main',
				{
					'bg-gray-300': disabled,
					'bg-gray-50': !disabled,
				},
			)}
		>
			<textarea
				ref={textareaRef}
				id="extendify-agent-chat-textarea"
				disabled={disabled}
				className={classNames(
					'flex max-h-[calc(75dvh)] min-h-10 w-full resize-none overflow-y-auto bg-transparent px-2 pb-4 pt-2.5 text-base placeholder:text-gray-700 focus:shadow-none focus:outline-hidden disabled:opacity-50 md:text-sm border-none text-gray-900',
				)}
				placeholder={
					block
						? __(
								'What do you want to change in the selected content?',
								'extendify-local',
							)
						: __('Ask anything', 'extendify-local')
				}
				rows="1"
				// biome-ignore lint: Allow autofocus here
				autoFocus
				value={input}
				onChange={(e) => {
					setInput(e.target.value);
					setHistoryIndex(null);
					adjustHeight();
				}}
				onKeyDown={handleKeyDown}
			/>
			<div className="flex justify-between gap-4 px-2 pb-2">
				{domTool ? <ChatTools disabled={disabled} /> : null}
				<div className="ms-auto flex items-center gap-2">
					<span
						className={classNames(
							'text-xs font-medium',
							overLimit ? 'text-red-600' : 'invisible',
						)}
						role="alert"
					>
						{overLimit && __('Message too long', 'extendify-local')}
					</span>
					<SubmitButton
						disabled={disabled}
						noInput={input.trim().length === 0}
						overLimit={overLimit}
						handleCancel={handleCancel}
					/>
				</div>
			</div>
		</form>
	);
};

const SubmitButton = ({ disabled, noInput, overLimit, handleCancel }) => {
	if (disabled) {
		return (
			<button
				type="button"
				onClick={handleCancel}
				className="inline-flex h-fit items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-design-main p-1 text-sm font-medium text-white transition-colors focus-visible:ring-design-main disabled:opacity-20"
			>
				<Icon fill="currentColor" icon={cancelRequest} size={18} />
				<span className="sr-only">{__('Cancel', 'extendify-local')}</span>
			</button>
		);
	}
	return (
		<button
			type="submit"
			className="inline-flex h-fit items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-design-main p-0.5 text-sm font-medium text-white transition-colors focus-visible:ring-design-main disabled:opacity-20"
			disabled={disabled || noInput || overLimit}
		>
			<Icon fill="currentColor" icon={arrowUp} size={24} />
			<span className="sr-only">{__('Send message', 'extendify-local')}</span>
		</button>
	);
};
