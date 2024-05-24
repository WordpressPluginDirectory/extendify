import { __ } from '@wordpress/i18n';
import { RecommendationCard } from '@assist/components/dashboard/RecommendationCard';
import { safeParseJson } from '@assist/lib/parsing';

const recommendations =
	safeParseJson(window.extAssistData.resourceData)?.recommendations || {};
const goals =
	safeParseJson(window.extSharedData?.userData?.userSelectionData)?.state
		?.goals || [];
const plugins =
	window.extSharedData?.installedPlugins?.map(
		(plugin) => plugin.split('/')[0],
	) || [];

export const Recommendations = () => {
	// Filter out recs that have goal deps that don't appear in the user's goals list
	// If no goal deps, show the rec
	const filteredRecommendations = recommendations
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
		);

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
