import { safeJsonStringify } from './shared';

// CI runs cypress against a native wp-cli install (see .github/workflows/e2e.yml's
// "Set up WordPress" step + the wp-cli.yml it writes). Locally we still go through
// wp-env's containerized cli. Both forms run from the repo root.
const wp = (args) =>
	Cypress.env('CI') ? `wp ${args}` : `npx wp-env run cli wp ${args}`;

Cypress.Commands.add('text', { prevSubject: true }, (subject, text) => {
	subject.val(text);
	return cy.wrap(subject);
});

Cypress.Commands.add('activateTheme', (theme) => {
	cy.log(`Activate ${theme} theme`);
	cy.exec(wp(`theme activate ${theme}`), {
		failOnNonZeroExit: false,
	});
});

Cypress.Commands.add(
	'updateWpConfig',
	(constant, val, flags = { raw: true }) => {
		cy.log(`Update WordPress config: ${constant}`);
		cy.exec(wp(`config set ${constant} ${val} ${flags.raw ? '--raw' : ''}`), {
			failOnNonZeroExit: false,
		}).then(({ stdout }) => cy.log(stdout));
	},
);

Cypress.Commands.add('resetAll', () => {
	cy.log('Reset WordPress');
	cy.resetWpDb();
	cy.clearBrowserStorage();
	cy.clearCookies();
	cy.updateWpConfig('EXTENDIFY_PARTNER_ID', null);
	cy.activateTheme('extendable');

	// Close pattern modal and welcome guide
	cy.exec(
		wp(
			'user meta add 1 wp_persisted_preferences \'{"core/edit-post":{"welcomeGuide":false,"core/edit-post/pattern-modal":false,"pattern-modal":false,"edit-post/pattern-modal":false,"patternModal":false},"core":{"enableChoosePatternModal":false},"_modified":"2025-03-23T02:16:33.561Z"}\' --format=json',
		),
	);
});

Cypress.Commands.add('resetWpDb', () => {
	cy.log('Reset database');
	if (Cypress.env('CI')) {
		cy.exec('wp db reset --yes', { failOnNonZeroExit: false });
		cy.exec(
			'wp core install --url=http://localhost:8888 --title=Test --admin_user=admin --admin_password=password --admin_email=admin@example.org --skip-email',
			{ failOnNonZeroExit: false },
		);
		// `wp db reset` wipes active_plugins. Re-activate so
		// PluginRedirectDisabler hooks `activated_plugin` before the spec
		// activates the third-party plugins under test.
		cy.exec('wp plugin activate extendify-sdk', { failOnNonZeroExit: false });
		return;
	}
	cy.exec('npx wp-env clean all', {
		failOnNonZeroExit: false,
	});
});

Cypress.Commands.add('updateOption', (key, val, options = { json: false }) => {
	cy.log(`Update WordPress database option: ${key}`);

	const command = options.json
		? `'${safeJsonStringify(val)}' --format=json`
		: val;
	cy.exec(wp(`option update ${key} ${command}`), {
		failOnNonZeroExit: false,
	});
});

Cypress.Commands.add('enableLaunch', (partnerId = 'github') => {
	cy.log('Enable Launch');
	cy.updateWpConfig('EXTENDIFY_PARTNER_ID', `"${partnerId}"`, { raw: false });

	// Required only when using the default partnerId, due to the new way of managing the showLaunch status.
	// Active partners will have this set to true by default.
	// More details: https://github.com/extendify/company-partnerships/issues/109
	if (partnerId === 'github') {
		cy.setPartner(partnerId, {
			showLaunch: true,
		});
	}
});

Cypress.Commands.add('setPartner', (name, options = {}) => {
	cy.updateWpConfig('EXTENDIFY_PARTNER_ID', `"${name}"`, { raw: false });
	const defaultOptions = {
		deactivated: false,
	};
	cy.addPartnerData({ ...defaultOptions, ...options });
});

Cypress.Commands.add('addPartnerData', (payload = {}) => {
	const serialized = JSON.stringify(payload);
	cy.exec(
		wp(`option update extendify_partner_data_v2 '${serialized}' --format=json`),
		{ raw: false },
	);
	cy.exec(
		wp("option update _transient_extendify_partner_data_cache_check '1'"),
		{ raw: false },
	);
});

Cypress.Commands.add('clearBrowserStorage', () => {
	cy.log('Clear browser local storage (including session storage)');
	cy.reload();
	cy.window().then((win) => {
		win.localStorage.clear();
		win.sessionStorage.clear();
	});
	// https://github.com/cypress-io/cypress/issues/2573#issuecomment-1339618812
	cy.clearAllLocalStorage();
});

Cypress.Commands.add('endTestCleanly', (path = '') => {
	cy.visitAdminPage(path);
});
