import { getAbTest } from '@auto-launch/functions/getAbTest';

afterEach(() => {
	window.extLaunchData = undefined;
});

describe('getAbTest', () => {
	it('returns variant and percentage from the assignment-record shape', () => {
		window.extLaunchData = {
			activeTests: {
				'AutoLaunch.ShowTitle': {
					variant: 'B',
					percentage: 20,
				},
			},
		};
		expect(getAbTest('AutoLaunch.ShowTitle')).toEqual({
			variant: 'B',
			percentage: 20,
		});
	});

	it('returns nulls for an unassigned test key', () => {
		window.extLaunchData = { activeTests: {} };
		expect(getAbTest('AutoLaunch.ShowTitle')).toEqual({
			variant: null,
			percentage: null,
		});
	});
});
