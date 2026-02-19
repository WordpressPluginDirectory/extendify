import { useWorkflowStore } from '@agent/state/workflows';
import { useCallback, useMemo } from '@wordpress/element';

export const useWhenFinishedToolProps = () => {
	const { whenFinishedToolProps, setWhenFinishedToolProps } =
		useWorkflowStore();

	const onConfirm = useCallback(
		(props = {}) => {
			if (!whenFinishedToolProps) return;
			window.dispatchEvent(
				new CustomEvent('extendify-agent:workflow-confirm', {
					detail: { ...props, whenFinishedToolProps },
				}),
			);
		},
		[whenFinishedToolProps],
	);

	const onCancel = useCallback(() => {
		if (!whenFinishedToolProps) return;
		window.dispatchEvent(
			new CustomEvent('extendify-agent:workflow-cancel', {
				detail: { whenFinishedToolProps },
			}),
		);
	}, [whenFinishedToolProps]);

	const onRetry = useCallback(() => {
		if (!whenFinishedToolProps) return;
		setWhenFinishedToolProps(null);
		window.dispatchEvent(
			new CustomEvent('extendify-agent:workflow-retry', {
				detail: { whenFinishedToolProps },
			}),
		);
	}, [whenFinishedToolProps, setWhenFinishedToolProps]);

	return useMemo(() => {
		if (!whenFinishedToolProps) return null;
		return { ...whenFinishedToolProps, onConfirm, onCancel, onRetry };
	}, [whenFinishedToolProps, onConfirm, onCancel, onRetry]);
};
