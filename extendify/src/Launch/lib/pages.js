import {
	ContentGathering,
	state as contentGatheringState,
} from '@launch/pages/ContentGathering';
import { Goals, state as goalsState } from '@launch/pages/Goals';
import { HomeSelect, state as homeSelectState } from '@launch/pages/HomeSelect';
import {
	ObjectiveSelection,
	state as objectiveSelectionState,
} from '@launch/pages/ObjectiveSelection';
import {
	PagesSelect,
	state as pagesSelectState,
} from '@launch/pages/PagesSelect';
import {
	SiteInformation,
	state as siteInfoState,
} from '@launch/pages/SiteInformation';
import { SitePrep, state as sitePrepState } from '@launch/pages/SitePrep';
import {
	SiteStructure,
	state as siteStructureState,
} from '@launch/pages/SiteStructure';
import { useUserSelectionStore } from '@launch/state/user-selections';

// This is the default pages array
// You can add pre-fetch functions to start fetching data for the next page
// Supports both [] and single fetcher functions
const initialPagesList = {
	'website-objective': {
		component: ObjectiveSelection,
		state: objectiveSelectionState,
		condition: ({ hideLaunchObjective }) => !hideLaunchObjective,
	},
	'site-information': {
		component: SiteInformation,
		state: siteInfoState,
	},
	'site-prep': {
		component: SitePrep,
		state: sitePrepState,
	},
	goals: {
		component: Goals,
		state: goalsState,
	},
	'site-structure': {
		component: SiteStructure,
		state: siteStructureState,
		condition: ({ siteObjective }) => siteObjective !== 'landing-page',
	},
	'content-fetching': {
		component: ContentGathering,
		state: contentGatheringState,
	},
	layout: {
		component: HomeSelect,
		state: homeSelectState,
	},
	'page-select': {
		component: PagesSelect,
		state: pagesSelectState,
		condition: ({ siteStructure }) => siteStructure === 'multi-page',
	},
};

export const getPages = () => {
	const { siteStructure, siteObjective } =
		useUserSelectionStore?.getState() ?? {};
	const { hideLaunchObjective } = window.extSharedData;
	const conditionData = { siteStructure, siteObjective, hideLaunchObjective };

	return Object.entries(initialPagesList).filter(
		([_, page]) => !page.condition || page.condition(conditionData),
	);
};

export const pages = getPages();
