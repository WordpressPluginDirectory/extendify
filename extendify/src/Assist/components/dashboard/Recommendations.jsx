import { __ } from '@wordpress/i18n';
import { RecommendationCard } from '@assist/components/dashboard/RecommendationCard';
import { safeParseJson } from '@assist/lib/parsing';
import { isAtLeastNDaysAgo } from '@assist/lib/recommendations';

const siteCreatedAt = window.extSharedData?.siteCreatedAt ?? '';
const recommendations =
	safeParseJson(window.extSharedData.resourceData)?.recommendations || [];
const goals =
	safeParseJson(window.extSharedData?.userData?.userSelectionData)?.state
		?.goals || [];
const plugins =
	window.extSharedData?.activePlugins?.map((plugin) => plugin.split('/')[0]) ||
	[];

const getRecommendations = () =>
	// Filter out recs that have goal deps that don't appear in the user's goals list
	// If no goal deps, show the rec
	recommendations
		.filter((rec) =>
			rec?.goalDepSlugs?.length
				? rec?.goalDepSlugs?.every((dep) =>
						goals.find(({ slug }) => slug === dep),
					)
				: true,
		)
		// Filter out recs that have pluginExclusions, and the plugin is already installed
		.filter((rec) =>
			rec?.pluginExclusions?.length
				? rec?.pluginExclusions?.every(
						(dep) => !plugins.find((plugin) => plugin === dep)?.length,
					)
				: true,
		)
		// Filter out recs where there is a plugin dep, and the plugin is not installed
		.filter((rec) =>
			rec?.pluginDepSlugs?.length
				? rec?.pluginDepSlugs?.every(
						(dep) => plugins.find((plugin) => plugin === dep)?.length,
					)
				: true,
		)
		.sort((a, b) => b.priority - a.priority)
		// filter out recs based on the showAfterDay field
		.filter((rec) =>
			// Only show recommendations after the number of days set in rec.showAfterDay
			isAtLeastNDaysAgo(siteCreatedAt, rec?.showAfterDay ?? 0) ? rec : false,
		);

export const Recommendations = () => {
	const filteredRecommendations = getRecommendations();

	if (!filteredRecommendations?.length) return;

	return (
		<div
			data-test="assist-recommendations-module"
			id="assist-recommendations-module"
			className="w-full p-5 lg:p-8 border border-gray-300 text-base bg-white rounded h-full">
			<h2 className="font-semibold text-lg mt-0 mb-4">
				{__('Website Tools & Plugins', 'extendify-local')}
			</h2>
			<div
				className="grid md:grid-cols-3 md:gap-3 gap-y-3"
				data-test="assist-recommendations-module-list">
				{filteredRecommendations.map((recommendation) => (
					<RecommendationCard
						key={recommendation.slug}
						recommendation={recommendation}
					/>
				))}
			</div>
		</div>
	);
};
