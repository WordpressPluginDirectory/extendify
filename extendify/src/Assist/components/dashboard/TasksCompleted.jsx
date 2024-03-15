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
		<div className="w-full bg-white mb-6 flex items-center rounded justify-center border border-gray-300">
			<div className="max-w-[720px] justify-center px-20 py-8 flex flex-col items-center">
				<AllCaughtUp aria-hidden={true} />
				<p className="mb-0 text-2xl font-bold">
					{__('All caught up!', 'extendify-local')}
				</p>
				<p className="mb-0 text-sm text-center">
					{__(
						"You've completed the set tasks—your site is looking good. This dashboard will update with new tasks and insights to keep your website evolving. Stay tuned!.",
						'extendify-local',
					)}
				</p>
				<button
					type="button"
					onClick={() => dismissBanner('tasks-completed')}
					className="text-design-main cursor-pointer text-center bg-transparent mt-8 py-2 px-2">
					{__('Dismiss', 'extendify-local')}
				</button>
			</div>
		</div>
	);
};
