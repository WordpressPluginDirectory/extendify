import { DOMHighlighter } from '@agent/components/DOMHighlighter';
import { DragResizeLayout } from '@agent/components/layouts/DragResizeLayout';
import { MobileLayout } from '@agent/components/layouts/MobileLayout';
import { useGlobalStore } from '@agent/state/global';
import { useWorkflowStore } from '@agent/state/workflows';
import { useEffect } from '@wordpress/element';

export const Chat = ({ busy, children }) => {
	const { setIsMobile, isMobile } = useGlobalStore();
	const { domToolEnabled, block, setBlock, setDomToolEnabled } =
		useWorkflowStore();

	useEffect(() => {
		if (!isMobile || !block) return;
		// Remove the block if we switch to mobile
		setBlock(null);
	}, [isMobile, setIsMobile, block, setBlock]);

	useEffect(() => {
		let timeout;
		const onResize = () => {
			clearTimeout(timeout);
			timeout = window.setTimeout(() => {
				setIsMobile(window.innerWidth < 783);
			}, 10);
		};
		window.addEventListener('resize', onResize);
		return () => {
			clearTimeout(timeout);
			window.removeEventListener('resize', onResize);
		};
	}, [setIsMobile]);

	useEffect(() => {
		// Exit select mode when Escape is pressed
		const onKeyDown = (e) => {
			if (e.key !== 'Escape' || !domToolEnabled) return;

			// Cancel the workflow
			window.dispatchEvent(new CustomEvent('extendify-agent:cancel-workflow'));

			// If a block is selected, clear it
			if (block) return setBlock(null);

			// If no block is selected, exit select mode
			setDomToolEnabled(false);
		};
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [domToolEnabled, block, setBlock, setDomToolEnabled]);

	if (isMobile) {
		return (
			<MobileLayout>
				<div
					id="extendify-agent-chat"
					className="flex min-h-0 flex-1 grow flex-col font-sans"
				>
					{children}
				</div>
			</MobileLayout>
		);
	}
	return (
		<DragResizeLayout>
			<div
				id="extendify-agent-chat"
				className="flex min-h-0 flex-1 grow flex-col font-sans"
			>
				{children}
			</div>
			{domToolEnabled && <DOMHighlighter busy={busy} />}
		</DragResizeLayout>
	);
};
