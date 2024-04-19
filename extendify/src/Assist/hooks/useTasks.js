import {
	showDomainTask,
	showSecondaryDomainTask,
	domainSearchUrl,
} from '@assist/lib/domains';
import { safeParseJson } from '@assist/lib/parsing';
import addPage from '@assist/tasks/add-page';
import demoCard from '@assist/tasks/demo-card';
import domainRecommendation from '@assist/tasks/domain-recommendation';
import editHomepage from '@assist/tasks/edit-homepage';
import secondaryDomainRecommendation from '@assist/tasks/secondary-domain-recommendation';
import setupGivewp from '@assist/tasks/setup-givewp';
import setupHubspot from '@assist/tasks/setup-hubspot';
import setupSimplyAppointments from '@assist/tasks/setup-simply-appointments';
import setupTec from '@assist/tasks/setup-tec';
import setupWoocommerceStore from '@assist/tasks/setup-woocommerce-store';
import siteAssistantTour from '@assist/tasks/site-assistant-tour';
import siteBuilderLauncher from '@assist/tasks/site-builder-launcher';
import updateSiteDescription from '@assist/tasks/update-site-description';
import uploadLogo from '@assist/tasks/upload-logo';
import uploadSiteIcon from '@assist/tasks/upload-site-icon';

const activePlugins = window.extSharedData?.activePlugins || [];
const userGoals =
	safeParseJson(window.extSharedData.userData.userSelectionData)?.state
		?.goals || {};

export const useTasks = () => {
	const tasks = Object.values({
		'site-builder-launcher': { ...siteBuilderLauncher },
		'site-assistant-tour': { ...siteAssistantTour },
		'domain-recommendation': { ...domainRecommendation },
		'secondary-domain-recommendation': { ...secondaryDomainRecommendation },
		'demo-card': { ...demoCard },
		'edit-homepage': { ...editHomepage },
		'add-page': { ...addPage },
		'upload-logo': { ...uploadLogo },
		'upload-site-icon': { ...uploadSiteIcon },
		'update-site-description': { ...updateSiteDescription },
		'setup-woocommerce-store': { ...setupWoocommerceStore },
		'setup-hubspot': { ...setupHubspot },
		'setup-givewp': { ...setupGivewp },
		'setup-tec': { ...setupTec },
		'setup-simply-appointments': { ...setupSimplyAppointments },
	});

	const pluginsToCheck = activePlugins?.map((plugin) => {
		try {
			return plugin.split('/')[0];
		} catch (e) {
			return plugin;
		}
	});

	return {
		tasks: tasks.filter((task) => {
			const {
				dependencies: { plugins, goals },
			} = task;

			return task.show({
				plugins,
				goals,
				activePlugins: pluginsToCheck,
				userGoals,
				showDomainTask: showDomainTask && domainSearchUrl,
				showSecondaryDomainTask: showSecondaryDomainTask && domainSearchUrl,
			});
		}),
	};
};
