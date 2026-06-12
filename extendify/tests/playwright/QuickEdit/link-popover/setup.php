<?php
require '/wordpress/wp-load.php';

// Narrow paragraph + a button block. The width matters: a paragraph
// inside a small container reproduces the "edit box reads as too short"
// half of the bug — the LinkControl popover gets sized to the canvas
// (which tracks the live block) when positioning is broken.
$content = "<!-- wp:group {\"layout\":{\"type\":\"constrained\",\"contentSize\":\"320px\"}} -->\n"
	. "<div class=\"wp-block-group\">\n"
	. "<!-- wp:paragraph -->\n"
	. "<p>Edit the link inside this paragraph for testing.</p>\n"
	. "<!-- /wp:paragraph -->\n"
	. "</div>\n"
	. "<!-- /wp:group -->\n\n"
	. "<!-- wp:buttons -->\n"
	. "<div class=\"wp-block-buttons\">\n"
	. "<!-- wp:button -->\n"
	. "<div class=\"wp-block-button\"><a class=\"wp-block-button__link wp-element-button\" href=\"https://example.com\">Open my long button link</a></div>\n"
	. "<!-- /wp:button -->\n"
	. "</div>\n"
	. "<!-- /wp:buttons -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Link Popover Test Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
