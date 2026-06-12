<?php
require '/wordpress/wp-load.php';

// Heading-heavy homepage so the spec has stable text targets that
// resolveTarget actually accepts. Paragraphs also resolve (detectBlockType
// derives core/<X> from any wp-block-X class), but the existing
// inline-text journey lives on headings; the trailing paragraph is kept
// so paragraph-specific specs have a stable target.
$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">First heading for inline-text testing.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Second heading for cancel testing.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Third heading for cmd-enter testing.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Fourth heading for undo testing.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p>Paragraphs only get Ask AI today, not Quick Edit.</p>\n"
	. "<!-- /wp:paragraph -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Test Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
