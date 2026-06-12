<?php
require '/wordpress/wp-load.php';

// Headings (which keyboard-entry.js leaves without role="button") are the
// canonical repro shape — Chrome's :focus-visible heuristic paints the
// default outline on a focused tabindex=0 heading even on mouse click, so
// they're the regression-prone case to pin.
$homeContent = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Sticky selection heading.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p>A paragraph below the heading for the outside-click case.</p>\n"
	. "<!-- /wp:paragraph -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Sticky Selection Home',
	'post_content' => $homeContent,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
