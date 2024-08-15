import { Flex, FlexBlock } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { store as editPostStore } from '@wordpress/edit-post';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/edit-post';
import { useEffect } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';
import { Draft } from '@draft/Draft';
import '@draft/app.css';
import { GenerateImageButtons } from '@draft/components/GenerateImageButtons';
import { ToolbarMenu } from '@draft/components/ToolbarMenu';
import { magic } from '@draft/svg';

registerPlugin('extendify-draft', {
	render: () => (
		<ExtendifyDraft>
			<PluginSidebarMoreMenuItem target="draft">
				{__('Draft', 'extendify-local')}
			</PluginSidebarMoreMenuItem>
			<PluginSidebar
				name="draft"
				icon={magic}
				title={__('AI Tools', 'extendify-local')}
				className="extendify-draft h-full">
				<Flex direction="column" expanded justify="space-between">
					<FlexBlock>
						<Draft />
					</FlexBlock>
				</Flex>
			</PluginSidebar>
		</ExtendifyDraft>
	),
});
const ExtendifyDraft = ({ children }) => {
	const { openGeneralSidebar } = useDispatch(editPostStore);
	useEffect(() => {
		const id = requestAnimationFrame(() => {
			openGeneralSidebar('extendify-draft/draft');
		});
		return () => cancelAnimationFrame(id);
	}, [openGeneralSidebar]);

	return children;
};

// Add the toolbar
addFilter(
	'editor.BlockEdit',
	'extendify-draft/draft-toolbar',
	(CurrentMenuItems) => (props) => ToolbarMenu(CurrentMenuItems, props),
);

// Add the Generate with AI button
addFilter(
	'editor.BlockEdit',
	'extendify-draft/draft-image',
	(CurrentComponents) => (props) =>
		GenerateImageButtons(CurrentComponents, props),
);
