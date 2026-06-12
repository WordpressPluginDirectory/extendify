<?php
require '/wordpress/wp-load.php';

// Sidebar-mode scroll guards need a page tall enough to scroll
// inside the wp-site-blocks container, plus a tagged block low enough on
// the page that scroll-position changes are observable via getBoundingClientRect.
$paragraphs = [];
for ($i = 1; $i <= 30; $i++) {
	$paragraphs[] = "<!-- wp:paragraph -->\n"
		. "<p>Filler paragraph {$i} to make the page taller than the viewport.</p>\n"
		. '<!-- /wp:paragraph -->';
}

$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Top heading.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. implode("\n\n", $paragraphs)
	. "\n\n<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Scroll target heading.</h2>\n"
	. "<!-- /wp:heading -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Sidebar Mode Scroll Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
