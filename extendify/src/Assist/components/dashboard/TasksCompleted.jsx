import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useConfetti } from '@assist/hooks/useConfetti';
import { useGlobalStore } from '@assist/state/globals';
import { AllCaughtUp } from '@assist/svg';

export const TasksCompleted = () => {
	const { dismissBanner, showConfetti, dismissConfetti } = useGlobalStore();

	useEffect(() => {
		dismissConfetti();
	}, [dismissConfetti]);

	useConfetti({ particleCount: 3, spread: 220 }, 2500, showConfetti);

	return (
		<div className="mb-6 flex w-full items-center justify-center rounded border border-gray-300 bg-white">
			<div className="flex max-w-[720px] flex-col items-center justify-center px-20 py-8">
				<AllCaughtUp aria-hidden={true} />
				<p className="mb-0 text-2xl font-bold">
					{__('All caught up!', 'extendify-local')}
				</p>
				<p className="mb-0 text-center text-sm">
					{__(
						"You've completed the set tasks—your site is looking good. This dashboard will update with new tasks and insights to keep your website evolving. Stay tuned!",
						'extendify-local',
					)}
				</p>
				<button
					type="button"
					onClick={() => dismissBanner('tasks-completed')}
					className="mt-8 cursor-pointer bg-transparent px-2 py-2 text-center text-design-main">
					{__('Dismiss', 'extendify-local')}
				</button>
			</div>
		</div>
	);
};
