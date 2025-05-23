// Default mock data to prevent runtime errors when modules/components are imported.
// This ensures tests don't break due to missing globals before individual test mocks are applied.
// You can still override these values within each test as needed.
global.window = global;
window.extSharedData = {
	root: 'https://test.extendify.local/wp-json/',
	nonce: 'fake-nonce',
	userData: {
		userSelectionData: {},
	},
};

window.extOnbData = {
	wpRoot: 'https://test.extendify.local/wp-json/',
};
