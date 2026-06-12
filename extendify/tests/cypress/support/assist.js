Cypress.Commands.add('setLaunchInProgress', () => {
	cy.log("Set Launch to an 'in progress' state");
	cy.updateOption('extendify_launch_loaded', new Date().toISOString());
});
