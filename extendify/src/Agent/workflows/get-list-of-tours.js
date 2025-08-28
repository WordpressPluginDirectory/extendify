import { ToursList } from '@agent/components/workflows/static/ToursList';

export default {
	available: () => true,
	id: 'list-tours',
	whenFinished: { component: ToursList },
};
