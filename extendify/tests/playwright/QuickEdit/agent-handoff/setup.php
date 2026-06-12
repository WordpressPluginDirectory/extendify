<?php
require '/wordpress/wp-load.php';

// Mixed block content for the QE → Agent handoff characterization:
//   - First heading: eligible for both Quick Edit and Ask AI.
//   - Spacer: wp-block-spacer class triggers IGNORED_CLASS_RX in
//     agent-gate.js, so the hover bar must not surface Ask AI.
//   - Post title: wp-block-post-* matches the same IGNORED_CLASS_RX.
//   - Second heading: also eligible — used to drive the selection-lock
//     assertion after the first heading has been picked.
$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">First heading for Ask AI handoff.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:spacer -->\n"
	. "<div style=\"height:80px\" aria-hidden=\"true\" class=\"wp-block-spacer\"></div>\n"
	. "<!-- /wp:spacer -->\n\n"
	. "<!-- wp:post-title /-->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Second heading for selection lock.</h2>\n"
	. "<!-- /wp:heading -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Agent Handoff Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
