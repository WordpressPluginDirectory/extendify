import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { magic } from '@agent/icons';
import { useGlobalStore } from '@agent/state/global';

export const PostEditor = () => {
	const { toggleOpen, isMobile } = useGlobalStore();

	if (isMobile) return null;

	return (
		<Button
			variant="primary"
			icon={magic}
			iconPosition="left"
			className="hidden gap-1 px-2 md:visible md:inline-flex xl:pe-3"
			onClick={() => toggleOpen()}
			aria-label={__('Open Agent', 'extendify-local')}>
			<span className="hidden xl:inline">
				{__('AI Agent', 'extendify-local')}
			</span>
		</Button>
	);
};
