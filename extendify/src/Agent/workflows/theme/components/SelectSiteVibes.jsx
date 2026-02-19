import { useSiteVibesOverride } from '@agent/hooks/useSiteVibesOverride';
import { useSiteVibesVariations } from '@agent/hooks/useSiteVibesVariations';
import { useChatStore } from '@agent/state/chat';
import { Tooltip } from '@wordpress/components';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export const SelectSiteVibes = ({ onConfirm, onCancel }) => {
	const { data, isLoading } = useSiteVibesVariations();
	const { vibes, css: styles } = data || {};
	const [selected, setSelected] = useState(null);
	const css = selected ? styles[selected] : '';
	const { undoChange } = useSiteVibesOverride({ css, slug: selected });
	const noVibes = !vibes || vibes.length === 0;
	const shuffled = useMemo(
		() => (vibes ? [...vibes].sort(() => Math.random() - 0.5) : []),
		[vibes],
	);
	const { addMessage, messages } = useChatStore();

	const handleConfirm = () => {
		if (!selected) return;
		onConfirm({ data: { selectedVibe: selected }, shouldRefreshPage: true });
	};

	const handleCancel = () => {
		undoChange();
		onCancel();
	};

	useEffect(() => {
		if (isLoading || !noVibes) return;
		const timer = setTimeout(() => onCancel(), 100);
		// translators: "site style" refers to the structural aesthetic style for the site.
		const content = __(
			'We were unable to find any site style for your theme.',
			'extendify-local',
		);
		const last = messages.at(-1)?.details?.content;
		if (content === last) return () => clearTimeout(timer);
		addMessage('message', { role: 'assistant', content, error: true });

		return () => clearTimeout(timer);
	}, [addMessage, onCancel, noVibes, messages, isLoading]);

	if (isLoading) {
		return (
			<div className="min-h-24 p-2 text-center text-sm">
				{
					// translators: "site style" refers to the structural aesthetic style for the site.
					__('Loading site style options...', 'extendify-local')
				}
			</div>
		);
	}

	if (noVibes) return null;

	const textColor = 'var(--wp--preset--color--foreground, inherit)';

	return (
		<div className="mb-4 ml-10 mr-2 flex flex-col rounded-lg border border-gray-300 bg-gray-50 rtl:ml-2 rtl:mr-10">
			<div className="rounded-lg border-b border-gray-300 bg-white">
				<div
					className="grid gap-2 p-3"
					style={{
						gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
					}}
				>
					{shuffled?.slice(0, 10).map(({ name, slug }) => (
						<Tooltip key={slug} text={name} placement="top">
							<style>
								{styles[slug]
									?.replaceAll(':root', '.ext-vibe-container')
									?.replaceAll(
										'is-style-ext-preset--',
										'preview-is-style-ext-preset--',
									)}
							</style>
							<button
								aria-label={name}
								type="button"
								className={`ext-vibe-container relative z-10 flex w-full appearance-none items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-none p-0 text-sm text-inherit shadow-vibe drop-shadow-md ${
									selected === slug ? 'z-0 ring-wp ring-design-main' : ''
								}`}
								onClick={() => setSelected(slug)}
							>
								<div
									className={`wp-block-group preview-is-style-ext-preset--group--${slug}--section has-background-background-color has-background p-3`}
								>
									<div
										style={{ color: textColor }}
										className={`wp-block-group has-tertiary-background-color has-background max-w-fit content-stretch items-center justify-center bg-design-tertiary p-3 text-2xl rtl:space-x-reverse preview-is-style-ext-preset--group--${slug}--item-card-1--align-center`}
									>
										<h1 className="mb-1 text-base font-semibold">
											{
												// translators: This is a placeholder title used in a visual preview of a site structural aesthetic styles. It demonstrates how the typography looks.
												__('Short title', 'extendify-local')
											}
										</h1>
										<p className="mt-1 text-xs font-light">
											{
												// translators: This is a placeholder description used in a visual preview of a site structural aesthetic styles. It demonstrates how the typography looks.
												__(
													'Short description of the content.',
													'extendify-local',
												)
											}
										</p>
									</div>
								</div>
							</button>
						</Tooltip>
					))}
				</div>
			</div>
			<div className="flex justify-start gap-2 p-3">
				<button
					type="button"
					className="w-full rounded-sm border border-gray-500 bg-white p-2 text-sm text-gray-900"
					onClick={handleCancel}
				>
					{__('Cancel', 'extendify-local')}
				</button>
				<button
					type="button"
					className="w-full rounded-sm border border-design-main bg-design-main p-2 text-sm text-white"
					disabled={!selected}
					onClick={handleConfirm}
				>
					{__('Save', 'extendify-local')}
				</button>
			</div>
		</div>
	);
};
