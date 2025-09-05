import { Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { Icon, page, close } from '@wordpress/icons';
import { useWorkflowStore } from '@agent/state/workflows';

export const PageDocument = ({ busy }) => {
	const { setBlock } = useWorkflowStore();
	return (
		<div className="flex items-center justify-between gap-1 text-sm text-gray-900">
			<div className="flex items-center gap-1">
				<Icon icon={page} />
				<div>{__('Content selected', 'extendify')}</div>
			</div>
			<Tooltip text={__('Remove', 'extendify-local')}>
				<button
					type="button"
					disabled={busy}
					className="flex h-full items-center rounded-none border-0 bg-transparent outline-none ring-design-main focus:shadow-none focus:outline-none focus-visible:outline-design-main"
					onClick={() => setBlock(null)}>
					<Icon
						className="pointer-events-none fill-current leading-none"
						icon={close}
						size={18}
					/>
					<span className="sr-only">{__('Remove', 'extendify-local')}</span>
				</button>
			</Tooltip>
		</div>
	);
};
