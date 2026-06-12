<?php
require '/wordpress/wp-load.php';

// Keyboard reach of Ask AI on Ask-AI-only blocks.
//   - Top-level group: tagged by TagBlocks (depth-1, not in $ignored) but
//     absent from QUICK_EDIT_BLOCK_TYPES, so it surfaces ONLY Ask AI. This
//     is the block the keyboard previously could not act on.
//   - Inner heading: quick-editable + AI-eligible — proves the keyboard
//     contract only changed for the Ask-AI-only container, not its editable
//     children.
$content = "<!-- wp:group {\"layout\":{\"type\":\"constrained\"}} -->\n"
	. "<div class=\"wp-block-group\"><!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Ask AI only group heading.</h2>\n"
	. "<!-- /wp:heading --></div>\n"
	. "<!-- /wp:group -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Keyboard Ask AI Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
