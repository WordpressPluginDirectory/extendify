import { patchVariantClasses } from '@agent/lib/variant-classes';
import { useWorkflowStore } from '@agent/state/workflows';
import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const dynamicClasses = ['is-style-ext-preset', 'is-style-outline'];

export const UpdateBlockConfirm = ({
	inputs,
	onConfirm,
	onCancel,
	onRetry,
}) => {
	const { block } = useWorkflowStore();
	const [loading, setLoading] = useState(true);
	const detachedEl = useRef(null);

	const undoBlockChange = useCallback(() => {
		const el = document.querySelector('[data-extendify-temp-replacement]');
		if (detachedEl.current) {
			el?.parentNode?.insertBefore(detachedEl.current, el);
			detachedEl.current = null;
		}
		if (el) el.remove();
	}, []);

	const confirmed = useRef(false);
	useEffect(() => {
		return () => {
			if (!confirmed.current) undoBlockChange();
		};
	}, []);

	const handleConfirm = async () => {
		confirmed.current = true;
		await onConfirm({ data: inputs, shouldRefreshPage: true });
	};

	const handleRetry = useCallback(() => {
		undoBlockChange();
		onRetry();
	}, [undoBlockChange, onRetry]);

	useEffect(() => {
		apiFetch({
			path: '/extendify/v1/agent/get-block-html',
			method: 'POST',
			data: { blockCode: inputs.newContent },
		}).then(({ content }) => {
			// Remove the highlighter
			window.dispatchEvent(new Event('extendify-agent:remove-block-highlight'));
			// hide the block
			const el = document.querySelector(
				`[data-extendify-agent-block-id="${block.id}"]`,
			);
			// TODO: work out a way to propagate an error here
			if (!el && !detachedEl.current) return onCancel();
			if (detachedEl.current) return; // already done
			detachedEl.current = el;

			const patched = patchVariantClasses(
				content,
				el.cloneNode(true),
				dynamicClasses,
			);

			const template = document.createElement('template');
			template.innerHTML = patched || '<div style="display:none"></div>';
			const newEl = template.content.firstElementChild;
			if (!newEl) return onCancel();
			const wpBlockAttributeClasses =
				/^has-([\w-]+-)?(background-color|color|font-size|gradient-background)$|^has-background$|^has-text-color$/;
			const newElClasses = new Set(newEl.classList);
			el.classList.forEach((className) => {
				if (newElClasses.has(className)) return;
				if (wpBlockAttributeClasses.test(className)) return;
				newEl.classList.add(className);
			});
			newEl.setAttribute('data-extendify-temp-replacement', true);
			// Strip animation classes so the preview is visible immediately.
			// The ext-animate--on class sets opacity:0 as initial state, but
			// the animation JS won't re-run on replaced DOM elements.
			for (const node of [
				newEl,
				...newEl.querySelectorAll('.ext-animate--on'),
			]) {
				node.classList.remove('ext-animate--on');
			}
			el.parentNode.insertBefore(newEl, el.nextSibling);
			el.parentNode?.removeChild(el);
			setLoading(false);
		});
	}, [block, inputs, onCancel]);

	if (loading)
		return (
			<Wrapper>
				<Content>{__('Loading...', 'extendify-local')}</Content>
			</Wrapper>
		);

	return (
		<Wrapper>
			<Content>
				<p className="m-0 p-0 text-sm text-gray-900">
					{__(
						'The agent has made the changes in the browser. Please review and confirm.',
						'extendify-local',
					)}
				</p>
			</Content>
			<div className="flex flex-wrap justify-start gap-2 p-3">
				<button
					type="button"
					className="flex-1 rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900"
					onClick={onCancel}
				>
					{__('Cancel', 'extendify-local')}
				</button>
				<button
					type="button"
					className="flex-1 rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900"
					onClick={handleRetry}
				>
					{__('Try Again', 'extendify-local')}
				</button>
				<button
					type="button"
					className="flex-1 rounded-sm border border-design-main bg-design-main p-2 text-sm text-white"
					onClick={handleConfirm}
				>
					{__('Save', 'extendify-local')}
				</button>
			</div>
		</Wrapper>
	);
};

const Wrapper = ({ children }) => (
	<div className="mb-4 ml-10 mr-2 flex flex-col rounded-lg border border-gray-300 bg-gray-50 rtl:ml-2 rtl:mr-10">
		{children}
	</div>
);

const Content = ({ children }) => (
	<div className="rounded-lg border-b border-gray-300 bg-white">
		<div className="p-3">{children}</div>
	</div>
);
