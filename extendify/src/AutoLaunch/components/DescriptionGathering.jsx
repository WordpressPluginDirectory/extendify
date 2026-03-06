import { fetchWithTimeout } from '@auto-launch/functions/helpers';
import { useInstallRequiredPlugins } from '@auto-launch/hooks/useInstallRequiredPlugins';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { AI_HOST } from '@constants';
import { useAIConsentStore } from '@shared/state/ai-consent';
import {
	forwardRef,
	useCallback,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { chevronRight, Icon } from '@wordpress/icons';
import classNames from 'classnames';

export const DescriptionGathering = () => {
	const { setData, descriptionBackup } = useLaunchDataStore();
	useInstallRequiredPlugins();
	const [input, setInput] = useState(descriptionBackup || '');
	const [improving, setImproving] = useState(false);
	const textareaRef = useRef(null);
	const { consentTerms } = useAIConsentStore();

	// resize the height of the textarea based on the content
	const adjustHeight = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		const bottomPadding = 120; // tweak as needed
		// Reset to measure natural height
		el.style.height = 'auto';

		const rect = el.getBoundingClientRect();
		const viewportHeight = window.innerHeight;

		const maxAvailable = Math.max(0, viewportHeight - rect.top - bottomPadding);
		const desired = el.scrollHeight;
		const nextHeight = Math.min(desired, maxAvailable);

		el.style.height = `${nextHeight}px`;
		el.style.overflowY = desired > maxAvailable ? 'auto' : 'hidden';

		// Notify others
		window.dispatchEvent(new Event('launch-textarea-resize'));
	}, []);

	const submitForm = (e) => {
		e.preventDefault();
		setData('descriptionRaw', input.trim());
	};

	const handleImprove = async () => {
		setImproving(true);
		const url = `${AI_HOST}/api/prompt/improve`;
		const method = 'POST';
		const headers = { 'Content-Type': 'application/json' };
		const response = await fetchWithTimeout(url, {
			method,
			headers,
			body: JSON.stringify({
				description: input.trim(),
				title: window.extSharedData.siteTitle,
			}),
		})
			.then((res) => res.ok && res.json())
			.catch(() => null);
		const nextValue = response?.improvedPrompt;
		setImproving(false);
		if (nextValue) {
			const el = textareaRef.current;
			if (!el) return setInput(nextValue);
			requestAnimationFrame(() => {
				// Preserve undo ability by using native events instead of React state
				el.focus();
				el.select();
				const ok = document.execCommand('insertText', false, nextValue);
				if (!ok) setInput(nextValue);
			});
		}
	};

	useEffect(() => {
		setData('descriptionBackup', input.trim());
		const raf = requestAnimationFrame(() => {
			adjustHeight();
		});
		return () => cancelAnimationFrame(raf);
	}, [input, setData]);

	useEffect(() => {
		const controller = new AbortController();
		const { signal } = controller;
		const handleResize = () => {
			adjustHeight();
			const c = textareaRef.current;
			c?.scrollTo(0, c.scrollHeight);
		};
		window.addEventListener('resize', handleResize, { signal });
		window.addEventListener('orientationchange', handleResize, { signal });
		adjustHeight();
		return () => controller.abort();
	}, [adjustHeight]);

	return (
		<>
			{/* biome-ignore lint: allow onClick without keyboard */}
			<form
				onSubmit={submitForm}
				onClick={() => textareaRef.current?.focus()}
				className="relative flex w-full flex-col p-6"
			>
				<div className="focus-within:border-design-main focus-within:ring-design-main w-full bg-white rounded-md text-gray-900 shadow-xl">
					<textarea
						ref={textareaRef}
						id="extendify-launch-chat-textarea"
						className={classNames(
							'flex min-h-36 w-full resize-none bg-transparent p-4 text-base placeholder:text-gray-700 focus:shadow-none focus:outline-hidden disabled:opacity-50 border-none text-gray-900',
							{
								'opacity-50': improving,
							},
						)}
						rows="1"
						// biome-ignore lint: Allow autofocus here
						autoFocus
						value={input}
						readOnly={improving}
						onChange={(e) => {
							setInput(e.target.value);
						}}
					/>
					<div className="flex justify-between items-end gap-4 p-2.5 px-4">
						<div>
							{input.trim().length > 20 && (
								<ImprovePrompt disabled={improving} onClick={handleImprove} />
							)}
						</div>
						<SubmitButton disabled={improving || input.trim().length === 0} />
					</div>
				</div>
			</form>
			<div
				className="text-pretty px-4 mt-4 text-center text-xss leading-none opacity-70 text-banner-text [&>a]:text-xss [&>a]:text-banner-text [&>a]:underline w-full absolute"
				dangerouslySetInnerHTML={{ __html: consentTerms }}
			/>
			<a
				className="text-sm font-medium underline text-banner-text fixed left-4 bottom-4 opacity-70 hover:opacity-100 transition-opacity"
				href={window.extSharedData.adminUrl}
			>
				{__('Exit to WP-Admin', 'extendify-local')}
			</a>
		</>
	);
};

const SubmitButton = forwardRef((props, ref) => (
	<button
		ref={ref}
		type="submit"
		className="inline-flex h-fit items-center justify-center gap-0.5 whitespace-nowrap border-0 bg-design-main p-2 py-1 text-sm font-medium text-white transition-colors focus-visible:ring-design-main disabled:opacity-20 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-2 group"
		{...props}
	>
		{__('Next', 'extendify-local')}
		<span className="transition-transform group-hover:translate-x-0.5">
			<Icon fill="currentColor" icon={chevronRight} size={24} />
		</span>
	</button>
));

const ImprovePrompt = (props) => {
	return (
		<button
			type="button"
			className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors underline disabled:text-gray-400 disabled:hover:text-gray-400"
			{...props}
		>
			{/* translators: "Enhance with AI" refers to improving the current input using AI. */}
			{__('Enhance with AI', 'extendify-local')}
		</button>
	);
};
