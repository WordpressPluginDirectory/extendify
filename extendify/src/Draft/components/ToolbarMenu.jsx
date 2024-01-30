import {
	BlockControls,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	Button,
	Dropdown,
	ToolbarGroup,
	NavigableMenu,
	MenuItem,
	MenuGroup,
} from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as editPostStore } from '@wordpress/edit-post';
import { __ } from '@wordpress/i18n';
import {
	Icon,
	customPostType,
	termDescription,
	paragraph,
	postContent,
} from '@wordpress/icons';
import { magic, twoLines } from '@draft/svg';

const supportedBlocks = [
	'core/paragraph',
	'core/list-item',
	'core/verse',
	'core/preformatted',
	'core/heading',
];

export const ToolbarMenu = (CurrentMenuItems, props) => {
	const { clientId: blockId } = props;
	const { getBlockName, getBlock } = useSelect((select) =>
		select(blockEditorStore),
	);
	const { getActiveGeneralSidebarName } = useSelect((select) =>
		select(editPostStore),
	);
	const { openGeneralSidebar } = useDispatch(editPostStore);

	// TODO: Only paragraphs?
	if (!supportedBlocks.includes(getBlockName(blockId))) {
		return <CurrentMenuItems {...props} />;
	}
	const text = getBlock(blockId)?.attributes?.content || '';
	const openDraft = () => openGeneralSidebar('extendify-draft/draft');
	const closeDraft = () => openGeneralSidebar('edit-post/block');
	const toggleDraft = () =>
		getActiveGeneralSidebarName() === 'extendify-draft/draft'
			? closeDraft()
			: openDraft();
	const updatePrompt = (detail) =>
		window.dispatchEvent(
			new CustomEvent('extendify-draft:set-prompt', { detail }),
		);
	return (
		<>
			<CurrentMenuItems {...props} />
			<BlockControls>
				<ToolbarGroup className="extendify-draft">
					<Dropdown
						renderContent={({ onClose }) => (
							<DropdownActions
								text={text}
								closePopup={onClose}
								openDraft={openDraft}
								updatePrompt={updatePrompt}
							/>
						)}
						renderToggle={({ isOpen, onToggle }) => {
							const handleClick = () => {
								if (!text) return toggleDraft();
								onToggle();
							};
							return (
								<Button
									onClick={handleClick}
									aria-expanded={isOpen}
									aria-haspopup="true"
									icon={magic}>
									{__('Ask AI', 'extendify-local')}
								</Button>
							);
						}}
					/>
				</ToolbarGroup>
			</BlockControls>
		</>
	);
};

const DropdownActions = ({ text, closePopup, openDraft, updatePrompt }) => {
	const actions = [
		{
			label: __('Improve writing', 'extendify-local'),
			promptType: 'improve-writing',
			systemMessageKey: 'edit',
			icon: <Icon icon={customPostType} />,
			disabled: () => false,
		},
		{
			label: __('Fix spelling & grammar', 'extendify-local'),
			promptType: 'fix-spelling-grammar',
			systemMessageKey: 'edit',
			icon: <Icon icon={termDescription} />,
			disabled: () => false,
		},
		{
			label: __('Simplify language', 'extendify-local'),
			promptType: 'simplify-language',
			systemMessageKey: 'edit',
			icon: <Icon icon={paragraph} />,
			disabled: () => false,
		},
		{
			label: __('Make shorter', 'extendify-local'),
			promptType: 'make-shorter',
			systemMessageKey: 'edit',
			icon: <Icon icon={twoLines} />,
			disabled: () => false,
		},
		{
			label: __('Make longer', 'extendify-local'),
			promptType: 'make-longer',
			systemMessageKey: 'edit',
			icon: <Icon icon={postContent} />,
			disabled: () => false,
		},
	];
	return (
		<NavigableMenu
			orientation="vertical"
			role="menu"
			style={{ minWidth: '200px' }}>
			<MenuGroup
				className="extendify-draft"
				label={
					<div className="flex items-center gap-2">
						<Icon className="fill-gray-900" size={16} icon={magic} />
						{__('Prompt AI to...', 'extendify-local')}
					</div>
				}>
				{actions.map(
					({ label, promptType, systemMessageKey, disabled, icon }) => (
						<MenuItem
							key={`${promptType}-${promptType}-${systemMessageKey}`}
							style={{ width: '100%' }}
							isSelected={false}
							disabled={disabled()}
							iconPosition="left"
							icon={icon}
							variant={undefined}
							onClick={() => {
								openDraft?.();
								closePopup?.();
								window.requestAnimationFrame(() =>
									window.requestAnimationFrame(() =>
										updatePrompt({ text, promptType, systemMessageKey }),
									),
								);
							}}>
							{label}
						</MenuItem>
					),
				)}
			</MenuGroup>
		</NavigableMenu>
	);
};
