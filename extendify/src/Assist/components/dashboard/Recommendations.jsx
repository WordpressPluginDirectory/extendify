import { __ } from '@wordpress/i18n';
import { RecommendationCard } from '@assist/components/dashboard/RecommendationCard';
import { safeParseJson } from '@assist/lib/parsing';

const recommendations =
	safeParseJson(window.extAssistData.resourceData)?.recommendations || {};

export const Recommendations = () => {
	if (!recommendations?.length) return;

	return (
		<div
			data-test="assist-recommendations-module"
			className="w-full p-5 lg:p-8 border border-gray-300 text-base bg-white rounded h-full">
			<h2 className="font-semibold text-lg mt-0 mb-4">
				{__('Website Tools & Plugins', 'extendify-local')}
			</h2>
			<div
				className="grid md:grid-cols-3 md:gap-3 gap-y-3"
				data-test="assist-recommendations-module-list">
				{recommendations.map((recommendation) => (
					<RecommendationCard
						key={recommendation.slug}
						recommendation={recommendation}
					/>
				))}
			</div>
		</div>
	);
};
