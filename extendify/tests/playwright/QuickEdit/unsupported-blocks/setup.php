<?php
require '/wordpress/wp-load.php';

// Seeds blocks that have no Quick Edit modal (group, media+text). After
// the selector-unification refactor these become selectable — the hover
// outline appears and the Ask AI pill renders — but the Quick Edit pill
// stays hidden because hasQuickEditModalFor() is false for these types.
// Padding on the group gives it hover surface above + below the heading.
// Without it, the heading fills the group's bounding box and a center
// hover lands on the heading (innermost-tagged wins),
// making the group itself unreachable. Real content always
// has spacing between blocks; the test fixture has to expose that.
$content = "<!-- wp:group {\"layout\":{\"type\":\"constrained\"},\"style\":{\"spacing\":{\"padding\":{\"top\":\"80px\",\"bottom\":\"80px\",\"left\":\"40px\",\"right\":\"40px\"}}}} -->\n"
	. "<div class=\"wp-block-group\" id=\"group-target\" style=\"padding-top:80px;padding-right:40px;padding-bottom:80px;padding-left:40px\">\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Inside a group container.</h2>\n"
	. "<!-- /wp:heading -->\n"
	. "</div>\n"
	. "<!-- /wp:group -->\n\n"
	. "<!-- wp:media-text {\"mediaId\":0,\"mediaType\":\"image\"} -->\n"
	. "<div class=\"wp-block-media-text alignwide is-stacked-on-mobile\" id=\"media-text-target\">"
	. "<figure class=\"wp-block-media-text__media\"></figure>"
	. "<div class=\"wp-block-media-text__content\">"
	. "<p>Media + text body copy.</p>"
	. "</div>"
	. "</div>\n"
	. "<!-- /wp:media-text -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Unsupported Blocks Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
