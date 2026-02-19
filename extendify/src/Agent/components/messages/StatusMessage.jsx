import { AnimateChunks } from '@agent/components/messages/AnimateChunks';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';
import classNames from 'classnames';

export const StatusMessage = ({ status, animate }) => {
	const { type, label } = status.details;
	const [content, setContent] = useState();
	const [loopIndex, setLoopIndex] = useState(0);
	const statusContent = useMemo(
		() => ({
			'calling-agent': __('Thinking...', 'extendify-local'),
			'agent-working': [
				__('Working on it...', 'extendify-local'),
				__('Interpreting message...', 'extendify-local'),
				__('Formulating a response...', 'extendify-local'),
				__('Reviewing logic...', 'extendify-local'),
			],
			'tool-started': label || __('Gathering data...', 'extendify-local'),
			'tool-completed': label || __('Analyzing...', 'extendify-local'),
			'tool-canceled': label || __('Canceled', 'extendify-local'),
			'workflow-canceled': label || __('Canceled', 'extendify-local'),
			'credits-exhausted': __('Usage limit reached', 'extendify-local'),
			'credits-restored': __('Usage limit restored', 'extendify-local'),
		}),
		[label],
	);
	const canAnimate = [
		'calling-agent',
		'agent-working',
		'tool-started',
	].includes(type);

	useEffect(() => {
		if (!Array.isArray(statusContent[type])) {
			setContent(statusContent[type]);
			return;
		}
		setContent(statusContent[type][loopIndex]);
		const timer = setTimeout(() => {
			setContent(null);
			setLoopIndex((prevIndex) => (prevIndex + 1) % statusContent[type].length);
		}, 5000);
		return () => {
			// we need to clear the content and make sure it hide the status correctly.
			setContent(null);
			clearTimeout(timer);
		};
	}, [type, statusContent, content, loopIndex]);

	if (type === 'workflow-tool-completed')
		return <WorkflowToolCompleted label={label} />;

	if (!content) return null;

	return (
		<div
			className={classNames('p-2 text-center text-xs italic text-gray-700', {
				'status-animation': canAnimate,
			})}
		>
			{animate ? (
				<AnimateChunks words={decodeEntities(content).split('')} delay={0.02} />
			) : (
				decodeEntities(content)
			)}
		</div>
	);
};

const WorkflowToolCompleted = ({ label }) => {
	return (
		<div className="flex w-full items-start gap-2.5 p-2">
			<div className="w-7 shrink-0" />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-center gap-2 rounded-lg border border-wp-alert-green bg-wp-alert-green/20 p-3 text-green-900">
					<div className="h-6 w-6 leading-none">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="size-6"
						>
							<title>{__('Success icon', 'extendify-local')}</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
							/>
						</svg>
					</div>
					<div className="text-sm">
						{decodeEntities(label) ||
							__('Workflow completed successfully', 'extendify-local')}
					</div>
				</div>
			</div>
		</div>
	);
};
