import { useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export const UpdatePostConfirm = ({ inputs, onConfirm, onCancel, onRetry }) => {
	const handleConfirm = () => {
		onConfirm({ data: inputs });
	};

	const handleRetry = useCallback(() => {
		const replacements = inputs.replacements || [];
		const reversed = replacements.map(({ original, updated }) => ({
			original: updated,
			updated: original,
		}));
		updateAllTextNodesAndAttributes(reversed);
		onRetry();
	}, [onRetry, inputs]);

	const handleCancel = useCallback(() => {
		const replacements = inputs.replacements || [];
		const reversed = replacements.map(({ original, updated }) => ({
			original: updated,
			updated: original,
		}));
		onCancel();
		updateAllTextNodesAndAttributes(reversed);
	}, [inputs, onCancel]);

	useEffect(() => {
		updateAllTextNodesAndAttributes(inputs.replacements);
	}, [inputs.replacements]);

	return (
		<div className="mb-4 ml-10 mr-2 flex flex-col rounded-lg border border-gray-300 bg-gray-50 rtl:ml-2 rtl:mr-10">
			<div className="rounded-lg border-b border-gray-300 bg-white">
				<div className="p-3">
					<p className="m-0 p-0 text-sm text-gray-900">
						{__(
							'The agent has made the changes in the browser. Please review and confirm.',
							'extendify-local',
						)}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap justify-start gap-2 p-3">
				<button
					type="button"
					className="flex-1 rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900"
					onClick={handleCancel}
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
		</div>
	);
};

const updateAllTextNodesAndAttributes = (replacements) => {
	const chat = document.getElementById('extendify-agent-chat');
	const isInChat = (node) => chat?.contains(node);
	// Update all text nodes
	const walker = document.createTreeWalker(
		document.body,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	let node = walker.nextNode();
	while (node) {
		const current = node;
		node = walker.nextNode();
		// Skip nodes that are inside the chat
		if (isInChat(current.parentNode)) continue;

		for (const { original, updated } of replacements ?? []) {
			const value = current.nodeValue ?? '';
			if (!value.includes(original)) continue;
			current.nodeValue = value.split(original).join(updated);
		}
	}

	// Update attributes
	['alt', 'title', 'aria-label'].forEach((attr) => {
		document.querySelectorAll(`[${attr}]`).forEach((el) => {
			// Skip elements that are inside the chat
			if (isInChat(el)) return;
			for (const { original, updated } of replacements ?? []) {
				const val = el.getAttribute(attr);
				if (!val?.includes(original)) continue;
				el.setAttribute(attr, val.split(original).join(updated));
			}
		});
	});
};
