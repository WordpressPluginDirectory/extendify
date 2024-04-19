import { Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { helpFilled } from '@wordpress/icons';
import { useGlobalSyncStore } from '@help-center/state/globals-sync';

export const AdminBar = () => {
	const { setVisibility } = useGlobalSyncStore();
	return (
		<button
			type="button"
			data-test="help-center-adminbar-button"
			onClick={() => setVisibility('open')}
			className="cursor-pointer inline-flex justify-center items-center gap-1 leading-extra-tight p-1 px-2 rounded-sm h-6 -mt-1 m-1.5 bg-wp-theme-main text-white border-0 focus:ring-wp focus:ring-wp-theme-main focus:outline-none ring-offset-1 ring-offset-wp-theme-bg">
			{__('Help', 'extendify-local')}
			<Icon
				icon={helpFilled}
				width={18}
				height={18}
				className="fill-design-text"
			/>
		</button>
	);
};
