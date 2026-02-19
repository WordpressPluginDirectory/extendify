import { UpdateLogoConfirm } from '@agent/workflows/theme/components/UpdateLogoConfirm';

const { abilities } = window.extAgentData;

export default {
	available: () => abilities?.canEditSettings && abilities?.canUploadMedia,
	id: 'update-logo',
	whenFinished: {
		component: UpdateLogoConfirm,
	},
};
