<?php
require '/wordpress/wp-load.php';

// Headings (top-level core/heading blocks) are tagged by TagBlocks
// with data-extendify-agent-block-id at render time, so they're the
// cheapest reliable target for selector + selection-lock assertions.
// Three headings give the spec separate targets for (a) the picked
// block, (b) the outside-click no-op, and (c) the QE-canvas vs.
// selector coordination check.
$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Selector target heading.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Outside click target heading.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">QE canvas heading.</h2>\n"
	. "<!-- /wp:heading -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Agent Selector UX Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
