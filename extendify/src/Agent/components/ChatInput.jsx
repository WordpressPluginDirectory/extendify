import {
	useState,
	useRef,
	useLayoutEffect,
	useEffect,
	useCallback,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, arrowUp } from '@wordpress/icons';
import classNames from 'classnames';

export const ChatInput = ({ disabled, handleSubmit }) => {
	const textareaRef = useRef(null);
	const [input, setInput] = useState('');
	const [longText, setLongText] = useState(false);
	const [history, setHistory] = useState([]);
	const dirtyRef = useRef(false);
	const [historyIndex, setHistoryIndex] = useState(null);

	// resize the height of the textarea based on the content
	const adjustHeight = useCallback(() => {
		if (!textareaRef.current) return;
		textareaRef.current.style.height = 'auto';
		const chat =
			textareaRef.current.closest('#extendify-agent-chat').offsetHeight * 0.55;
		const h = Math.min(chat, textareaRef.current.scrollHeight + 2);
		setLongText(h > 80);
		textareaRef.current.style.height = `${h}px`;
	}, []);

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
			if (!input.trim()) return;
			handleSubmit(input);
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
		[input, handleSubmit, adjustHeight],
	);

	const handleKeyDown = useCallback(
		(event) => {
			if (
				event.key === 'Enter' &&
				!event.shiftKey &&
				!event.nativeEvent.isComposing
			) {
				event.preventDefault();
				submitForm();
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
		[history, historyIndex, submitForm],
	);

	return (
		<form
			onSubmit={submitForm}
			className="relative flex w-full flex-col gap-4 p-4 pb-2 pt-0">
			<textarea
				ref={textareaRef}
				id="extendify-agent-chat-textarea"
				disabled={disabled}
				className={classNames(
					'flex max-h-[calc(75dvh)] min-h-10 w-full resize-none overflow-hidden rounded border border-gray-300 px-3 py-[9px] text-base placeholder:text-gray-700 focus-within:outline-design-main focus:rounded focus:border-design-main focus:ring-design-main disabled:opacity-50 md:text-sm',
					{
						'bg-gray-300': disabled,
						'bg-gray-50': !disabled,
						'pr-6': !longText,
					},
				)}
				placeholder={__('Ask anything', 'extendify-local')}
				rows="1"
				autoFocus
				value={input}
				onChange={(e) => {
					setInput(e.target.value);
					setHistoryIndex(null);
					adjustHeight();
				}}
				onKeyDown={handleKeyDown}
			/>
			<div className="absolute bottom-[1.125rem] right-6 flex flex-row justify-end md:bottom-4 rtl:left-6 rtl:right-auto">
				<button
					type="submit"
					className="inline-flex h-fit items-center justify-center gap-2 whitespace-nowrap rounded-full border bg-design-main p-0.5 text-sm font-medium text-white transition-colors focus-visible:ring-design-main disabled:opacity-20"
					disabled={disabled || input.trim().length === 0}>
					<Icon fill="currentColor" icon={arrowUp} size={18} />
					<span className="sr-only">
						{__('Send message', 'extendify-local')}
					</span>
				</button>
			</div>
		</form>
	);
};
