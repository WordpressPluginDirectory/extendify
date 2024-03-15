import { __ } from '@wordpress/i18n';

export const CardsTitle = ({ total = 8, totalCompleted = 3 }) => (
	<div className="flex items-center justify-between space-x-2 w-full border-b border-gray-300 py-3.5 px-5 lg:px-6">
		<span className="text-base font-semibold">
			{__('Site Guide', 'extendify-local')}
		</span>
		<div className="w-3/5 flex items-center gap-2">
			<div className="w-full bg-gray-300 rounded-xl h-2.5">
				<div
					className="bg-design-main h-2.5 rounded-xl"
					style={{
						width: `${100 / (total / totalCompleted)}%`,
					}}></div>
			</div>
			<div className="text-gray-700 text-xs">
				{totalCompleted}/{total}
			</div>
		</div>
	</div>
);
