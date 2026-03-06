import { SelectGeneratedPalette } from '@agent/workflows/theme/components/SelectGeneratedPalette';

const { abilities } = window.extAgentData;

export default {
	available: () => abilities?.canEditThemes,
	id: 'generate-color-palette',
	whenFinished: {
		component: SelectGeneratedPalette,
	},
};
