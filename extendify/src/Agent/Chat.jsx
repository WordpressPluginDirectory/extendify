import { useEffect } from '@wordpress/element';
import { DOMHighlighter } from '@agent/components/DOMHighlighter';
import { DragResizeLayout } from '@agent/components/layouts/DragResizeLayout';
import { MobileLayout } from '@agent/components/layouts/MobileLayout';
import { useGlobalStore } from '@agent/state/global';

const domToolEnabled = false;

export const Chat = ({ busy, children }) => {
	const { setIsMobile, isMobile } = useGlobalStore();

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

	if (isMobile) {
		return (
			<MobileLayout>
				<div
					id="extendify-agent-chat"
					className="flex min-h-0 flex-1 flex-grow flex-col font-sans">
					{children}
				</div>
			</MobileLayout>
		);
	}
	return (
		<DragResizeLayout>
			<div
				id="extendify-agent-chat"
				className="flex min-h-0 flex-1 flex-grow flex-col font-sans">
				{children}
			</div>
			{domToolEnabled && <DOMHighlighter busy={busy} />}
		</DragResizeLayout>
	);
};
