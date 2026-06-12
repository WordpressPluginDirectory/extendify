<?php
require '/wordpress/wp-load.php';

$userId = 1;

// Mirrors the user-meta block in cypress/support/helpers.js cy.resetAll() so
// specs don't have to dismiss welcome guides / pattern modals on first paint.
$userSettings = [
	'core/edit-post' => [
		'welcomeGuide' => false,
		'core/edit-post/pattern-modal' => false,
		'pattern-modal' => false,
		'edit-post/pattern-modal' => false,
		'patternModal' => false,
	],
	'core/edit-site' => ['welcomeGuide' => false],
	'core' => ['enableChoosePatternModal' => false],
	'_modified' => gmdate('c'),
];
update_user_meta($userId, 'wp_persisted_preferences', $userSettings);

// Theme-agnostic "blueprint applied" marker for global-setup.ts. setup.php is
// the last blueprint step, so this lands after every other seed. Exposed via
// the public /?rest_route=/ JSON root (which echoes blogdescription) so the
// poller doesn't need auth.
update_option('blogdescription', 'extendify-pw-blueprint-ready');
