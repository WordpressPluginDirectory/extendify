import { BlockControls } from '@wordpress/block-editor';
import { Button, MenuItem } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { store as editPostStore } from '@wordpress/edit-post';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { render } from '@draft/lib/dom';
import { magic } from '@draft/svg';

const supportedBlocks = [
	'core/image',
	'core/media-text',
	'core/gallery',
	'core/cover',
];

export const GenerateImageButtons = (CurrentComponents, props) => {
	const { openGeneralSidebar } = useDispatch(editPostStore);
	const { clientId: blockId, name: name } = props;

	useEffect(() => {
		if (!supportedBlocks.includes(name)) return;

		const frameSelector = 'iframe[name="editor-canvas"]';
		const frame = document.querySelector(frameSelector)?.contentDocument;

		const block = frame
			? frame.querySelector(`[data-block="${blockId}"]`)
			: document.querySelector(`[data-block="${blockId}"]`);
		if (!block) return;

		const parentSelector =
			'.block-editor-media-placeholder .components-form-file-upload';
		const placeHolder = Object.assign(document.createElement('div'), {
			className: 'components-form-file-upload',
		});
		block.querySelector(parentSelector)?.after(placeHolder);

		let root;
		const component = (
			<>
				<Button
					variant="primary"
					onClick={async () => {
						openGeneralSidebar('extendify-draft/draft');
						await new Promise((r) => requestAnimationFrame(r));
						document.getElementById('draft-ai-image-textarea')?.focus();
					}}>
					{__('Get Personalized Image', 'extendify-local')}
				</Button>
				{/* layout placeholder */}
				<span aria-hidden="true" />
			</>
		);
		const id = requestAnimationFrame(() => {
			root = render(component, placeHolder);
		});
		return () => {
			cancelAnimationFrame(id);
			root?.unmount();
			placeHolder?.remove();
		};
	}, [blockId, openGeneralSidebar, name]);

	return (
		<>
			<CurrentComponents {...props} />
			<BlockControls>
				<ToolbarButtons {...props} />
			</BlockControls>
		</>
	);
};

const ToolbarButtons = ({ name, attributes }) => {
	const { openGeneralSidebar } = useDispatch(editPostStore);

	useEffect(() => {
		if (!supportedBlocks.includes(name)) return;

		let placeholder, root, rafInsert, rafOuter, observer;
		// use async iife to allow frame delays
		(async () => {
			await new Promise((r) => (rafOuter = requestAnimationFrame(r)));
			// Find a button on the toolbar that says replace or add
			const replaceBtn = Array.from(
				document.querySelectorAll('[data-toolbar-item="true"]'),
			)?.find(
				(btn) =>
					btn.textContent === __('Replace') || btn.textContent === __('Add'),
			);
			if (!replaceBtn) return;

			const element = (
				<MenuItem
					icon={magic}
					onClick={async () => {
						openGeneralSidebar('extendify-draft/draft');
						await new Promise((r) => requestAnimationFrame(r));
						document.getElementById('draft-ai-image-textarea')?.focus();
					}}>
					{__('Get Personalized Image', 'extendify-local')}
				</MenuItem>
			);
			observer = new MutationObserver((mutations) => {
				// Button is open
				if (mutations[0].target.getAttribute('aria-expanded') === 'true') {
					// Find the popover section we want to attach to
					const pClass = '.block-editor-media-replace-flow__media-upload-menu';
					const popover = document.querySelector(pClass);
					if (!popover) return;

					// Attach the placeholder to the popover then render
					placeholder = document.createElement('div');
					popover.prepend(placeholder);
					rafInsert = requestAnimationFrame(() => {
						root = render(element, placeholder);
					});
					return;
				}
				// Replace button is closed
				cancelAnimationFrame(rafInsert);
				root?.unmount();
				placeholder?.remove();
			});

			// Watch for aria-expanded attribute only
			observer.observe(replaceBtn, {
				attributes: true,
				childList: false,
				subtree: false,
			});
		})();

		return () => {
			[rafInsert, rafOuter].forEach(cancelAnimationFrame);
			root?.unmount();
			placeholder?.remove();
			observer?.disconnect();
		};
	}, [name, attributes, openGeneralSidebar]);
	return null;
};
