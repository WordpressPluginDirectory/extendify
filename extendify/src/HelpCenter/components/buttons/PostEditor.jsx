import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { helpFilled, Icon } from '@wordpress/icons';
import { useGlobalSyncStore } from '@help-center/state/globals-sync';

export const PostEditor = () => {
	const { setVisibility } = useGlobalSyncStore();
	return (
		<Button
			className="inline-flex gap-1 ml-1"
			data-test="help-center-editor-page-button"
			onClick={() => setVisibility('open')}
			variant="primary">
			{__('Help', 'extendify-local')}
			<Icon
				icon={helpFilled}
				width={18}
				height={18}
				className="fill-design-text"
			/>
		</Button>
	);
};
