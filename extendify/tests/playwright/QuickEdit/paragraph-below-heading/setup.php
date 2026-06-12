<?php
require '/wordpress/wp-load.php';

// Seed: paragraph directly below a heading. Two
// arrangements: top-level siblings (each block tagged at depth=1 by
// TagBlocks) and a group container (only the group is tagged). Both used
// to resolve to the heading via the old `isRecognizedBlockEl`
// preference in findTagged; with the type-gate dropped and the capture-rule
// in place, the innermost tagged ancestor wins regardless of which child
// happens to carry a recognized class.
$homeContent = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\" id=\"top-heading\">Top-level heading.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p id=\"top-paragraph\">Top-level paragraph sitting directly below the heading.</p>\n"
	. "<!-- /wp:paragraph -->\n\n"
	. "<!-- wp:group {\"layout\":{\"type\":\"constrained\"}} -->\n"
	. "<div class=\"wp-block-group\" id=\"group-target\">\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\" id=\"group-heading\">Heading inside group.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p id=\"group-paragraph\">Paragraph inside the group, directly below the heading.</p>\n"
	. "<!-- /wp:paragraph -->\n"
	. "</div>\n"
	. "<!-- /wp:group -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Paragraph Below Heading Home',
	'post_content' => $homeContent,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
