import { toolSelect } from '@agent/icons';
import { useWorkflowStore } from '@agent/state/workflows';
import { useEditModeStore } from '@quick-edit/state/edit-mode';
import { __ } from '@wordpress/i18n';
import { closeSmall, Icon } from '@wordpress/icons';
import classNames from 'classnames';

export const ChatTools = ({ disabled = false }) => {
	const { getWorkflowsByFeature } = useWorkflowStore();
	const editModeOn = useEditModeStore((s) => s.on);
	const domTool = getWorkflowsByFeature({ requires: ['block'] })?.length > 0;

	const handleClose = () => {
		window.dispatchEvent(new CustomEvent('extendify-agent:cancel-workflow'));
		useEditModeStore.getState().toggle();
	};

	if (!domTool) return null;
	return (
		<div className="flex items-center">
			<button
				type="button"
				disabled={disabled}
				className={classNames(
					'm-0 flex items-center rounded-sm border-0 px-1 py-0.5 leading-none disabled:opacity-50 text-gray-900',
					{
						'bg-gray-300': editModeOn,
						'bg-gray-100 text-gray-900': !editModeOn,
						'hover:bg-gray-200': !disabled,
					},
				)}
				onClick={handleClose}
			>
				<Icon size={24} icon={toolSelect} />
				<span className="px-1 text-sm font-medium">
					{__('Select', 'extendify-local')}
				</span>
				{editModeOn && (
					<Icon size={20} icon={closeSmall} className="fill-current" />
				)}
			</button>
		</div>
	);
};
