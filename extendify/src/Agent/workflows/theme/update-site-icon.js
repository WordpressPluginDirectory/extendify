import { UpdateSiteIconConfirm } from '@agent/workflows/theme/components/UpdateSiteIconConfirm';

const { abilities } = window.extAgentData;

export default {
	available: () => abilities?.canEditSettings && abilities?.canUploadMedia,
	id: 'update-site-icon',
	whenFinished: {
		component: UpdateSiteIconConfirm,
	},
};
