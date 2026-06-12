const plugins = [
	{ name: 'WPForms', wordpressSlug: 'wpforms-lite' },
	{ name: 'WP Mail SMTP', wordpressSlug: 'wp-mail-smtp' },
	{ name: 'MonsterInsights', wordpressSlug: 'google-analytics-for-wordpress' },
	{ name: 'WooCommerce', wordpressSlug: 'woocommerce' },
	{ name: 'All in One SEO', wordpressSlug: 'all-in-one-seo-pack' },
	{ name: 'Really Simple SSL', wordpressSlug: 'really-simple-ssl' },
	{ name: 'Imagify', wordpressSlug: 'imagify' },
	{ name: 'Complianz GDPR', wordpressSlug: 'complianz-gdpr' },
	{ name: 'Charitable', wordpressSlug: 'charitable' },
	{ name: 'GiveWP', wordpressSlug: 'give' },
	{ name: 'Rank Math SEO', wordpressSlug: 'seo-by-rank-math' },
	{ name: 'Sugar Calendar Lite', wordpressSlug: 'sugar-calendar-lite' },
	{ name: 'The Events Calendar', wordpressSlug: 'the-events-calendar' },
	{
		name: 'Complianz Terms & Conditions',
		wordpressSlug: 'complianz-terms-conditions',
	},
	{ name: 'SimplyBook.me', wordpressSlug: 'simplybook' },
	{ name: 'Yoast SEO', wordpressSlug: 'wordpress-seo' },
	{ name: 'WooCommerce Germanized', wordpressSlug: 'woocommerce-germanized' },
	{
		name: 'TranslatePress',
		wordpressSlug: 'translatepress-multilingual',
	},
	{ name: 'Ecwid', wordpressSlug: 'ecwid-shopping-cart' },
	{ name: 'ChatBot', wordpressSlug: 'chatbot' },
];

const allSlugs = plugins.map((p) => p.wordpressSlug).join(' ');

// 15 plugins split 3×5 into "group" fixtures that share a cypress job. The 5
// heavy plugins each get their OWN fixture — workflow runs them as separate
// matrix entries so one flaky activation (e.g. RSSSL fatal, WooCommerce queue
// bailout) doesn't bury the others. Plugin FILES are pre-installed once per job
// by the workflow; the DB is reset between fixtures so each starts clean.
//
// Matrix dispatcher: workflow passes CYPRESS_FIXTURE to pick which fixtures
// this job runs. "groups" → the 3 group fixtures. "<slug>" → one heavy plugin.
const groupFixtures = [
	{
		name: 'deleteOptions + transients + URL intercept + activate_*',
		slugs: [
			'give',
			'wpforms-lite',
			'all-in-one-seo-pack',
			'ecwid-shopping-cart',
			'wordpress-seo',
		],
	},
	{
		name: 'transient + filter-hook combo',
		slugs: [
			'wp-mail-smtp',
			'google-analytics-for-wordpress',
			'charitable',
			'seo-by-rank-math',
			'simplybook',
		],
	},
	{
		name: 'complianz + sugar + chatbot',
		slugs: [
			'imagify',
			'complianz-gdpr',
			'complianz-terms-conditions',
			'sugar-calendar-lite',
			'chatbot',
		],
	},
];

const heavyPluginSlugs = [
	'the-events-calendar',
	'woocommerce',
	'really-simple-ssl',
	'woocommerce-germanized',
	'translatepress-multilingual',
];

const heavyFixtures = heavyPluginSlugs.map((slug) => ({
	name: `heavy: ${slug}`,
	slugs: [slug],
}));

const fixturesForRun = () => {
	const filter = Cypress.env('FIXTURE');
	if (!filter || filter === 'all') return [...groupFixtures, ...heavyFixtures];
	if (filter === 'groups') return groupFixtures;
	return heavyFixtures.filter((f) => f.slugs[0] === filter);
};

const fixtures = fixturesForRun();

const wpCli = (command) => {
	const prefix = Cypress.env('CI') ? 'wp' : 'npx wp-env run cli wp';
	return cy.exec(`${prefix} ${command}`, {
		timeout: 120000,
		failOnNonZeroExit: false,
	});
};

const waitForActive = (slugs, attemptsLeft = 60) => {
	wpCli('plugin list --status=active --field=name').then(({ stdout }) => {
		const active = stdout.split('\n').filter(Boolean);
		const missing = slugs.filter((slug) => !active.includes(slug));
		if (!missing.length) return;
		cy.log(
			`Activation poll (${attemptsLeft} left). Still missing: ${missing.join(', ')}`,
		);
		if (attemptsLeft <= 0) {
			throw new Error(
				`Plugins never activated after 120s: ${missing.join(', ')}`,
			);
		}
		cy.wait(2000);
		waitForActive(slugs, attemptsLeft - 1);
	});
};

before(() => {
	if (Cypress.env('CI')) {
		// Pre-installed by .github/workflows/e2e.yml's "Pre-install test
		// plugins" step — assert presence and continue.
		wpCli('plugin list --field=name').then(({ stdout }) => {
			const installed = new Set(stdout.split('\n').filter(Boolean));
			const missing = plugins
				.map((p) => p.wordpressSlug)
				.filter((slug) => !installed.has(slug));
			expect(missing, 'plugins missing from disk').to.have.length(0);
		});
		return;
	}
	wpCli(`plugin install ${allSlugs}`);
});

after(() => {
	if (!Cypress.env('CI')) {
		wpCli(`plugin uninstall ${allSlugs} --deactivate`);
	}
	cy.endTestCleanly();
});

describe('Plugin Redirect Disabler', () => {
	// Several of the activated plugins enqueue wizard JS globally (not gated
	// on $hook), so when the redirect to their wizard is blocked, that JS
	// runs on /wp-admin/ instead and trips over missing wizard elements.
	// That's a third-party-code-quality issue, not our redirect contract —
	// our URL assertion is what we're testing.
	Cypress.on('uncaught:exception', () => false);

	beforeEach(() => {
		cy.resetAll();
		cy.setPartner('github', { showLaunch: true, useAgentOnboarding: true });
	});

	fixtures.forEach((fixture) => {
		it(`does not redirect after AutoLaunch activates ${fixture.name}`, () => {
			const selectedPlugins = plugins.filter((p) =>
				fixture.slugs.includes(p.wordpressSlug),
			);
			cy.intercept('POST', '**/api/site-plugins**', {
				body: { selectedPlugins },
			});
			cy.loginUser();
			cy.visitAdminPage('admin.php', 'page=extendify-auto-launch');
			waitForActive(fixture.slugs);
			cy.visitAdminPage('index.php');
			cy.url().should('not.include', 'page=');
		});
	});
});
