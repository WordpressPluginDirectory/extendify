import { fetchWithTimeout } from '@auto-launch/functions/helpers';
import { useInstallRequiredPlugins } from '@auto-launch/hooks/useInstallRequiredPlugins';
import { loaderThreeDots } from '@auto-launch/icons';
import { useLaunchDataStore } from '@auto-launch/state/launch-data';
import { AI_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';
import { useAIConsentStore } from '@shared/state/ai-consent';
import {
	forwardRef,
	useCallback,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { chevronRight, Icon, pencil } from '@wordpress/icons';

export const DescriptionGathering = () => {
	const { setData, descriptionBackup, urlParams } = useLaunchDataStore();
	useInstallRequiredPlugins();
	const [input, setInput] = useState(
		urlParams.description || urlParams.title || descriptionBackup || '',
	);
	const [improving, setImproving] = useState(false);
	const [lastImproved, setLastImproved] = useState(null);
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
		setData('go', true);
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
				...reqDataBasics,
				description: input.trim(),
				title: window.extSharedData.siteTitle,
			}),
		})
			.then((res) => res.ok && res.json())
			.catch(() => null);
		const nextValue = response?.improvedPrompt;
		setImproving(false);
		if (nextValue) {
			setLastImproved(nextValue);
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
				className="relative flex w-full flex-col"
			>
				<div className="w-full rounded-3xl border border-gray-300 bg-gray-100/80 text-gray-900 backdrop-blur-2xl focus-within:border-gray-500 focus-within:ring-gray-500 shadow-md overflow-hidden">
					{improving ? (
						<div className="flex h-49 flex-col items-center justify-center gap-4">
							<div className="h-12 w-12 text-design-main">
								{loaderThreeDots}
							</div>
							<p className="m-0 text-base leading-6 text-center text-gray-800">
								{__('Enhancing the website description...', 'extendify-local')}
							</p>
						</div>
					) : (
						<>
							<textarea
								ref={textareaRef}
								id="extendify-launch-chat-textarea"
								className="flex min-h-20 md:min-h-24 w-full resize-none bg-transparent text-base leading-6 placeholder:text-gray-700 focus:shadow-none focus:outline-hidden border-none text-gray-900 p-6 pb-0"
								rows="1"
								// biome-ignore lint: Allow autofocus here
								autoFocus
								value={input}
								onChange={(e) => {
									setInput(e.target.value);
								}}
								placeholder={__(
									'Ask AI to create a website for a cafe...',
									'extendify-local',
								)}
							/>
							<div className="flex justify-between items-end gap-4 p-6">
								<div>
									<ImprovePrompt
										disabled={
											input.trim().length === 0 || input.trim() === lastImproved
										}
										onClick={handleImprove}
									/>
								</div>
								<SubmitButton disabled={input.trim().length === 0} />
							</div>
						</>
					)}
				</div>
			</form>
			<div
				className="text-pretty mt-4 text-center text-xs leading-4 opacity-70 text-banner-text [&>a]:text-xs [&>a]:text-banner-text [&>a]:underline w-full"
				dangerouslySetInnerHTML={{ __html: consentTerms }}
			/>
		</>
	);
};

const SubmitButton = forwardRef((props, ref) => (
	<button
		ref={ref}
		type="submit"
		className="inline-flex items-center justify-center rounded-full border-0 bg-design-main px-3 py-2 text-sm leading-5 font-normal text-design-text focus-visible:ring-design-main disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-2 group hover:opacity-90 transition-opacity"
		{...props}
	>
		<span className="px-1">{__('Next', 'extendify-local')}</span>
		<Icon fill="currentColor" icon={chevronRight} size={24} />
	</button>
));

const ImprovePrompt = (props) => {
	return (
		<button
			type="button"
			className="inline-flex items-center rounded-full ring-1 ring-gray-800 px-3 py-2 text-sm leading-5 font-normal text-gray-800 transition-colors hover:bg-gray-600/5 disabled:opacity-40"
			{...props}
		>
			<Icon icon={pencil} size={24} />
			{/* translators: "Enhance with AI" refers to improving the current input using AI. */}
			<span className="px-1">{__('Enhance with AI', 'extendify-local')}</span>
		</button>
	);
};
