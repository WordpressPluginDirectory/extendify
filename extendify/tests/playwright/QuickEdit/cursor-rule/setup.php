<?php
require '/wordpress/wp-load.php';

// Cursor-rule seed: a tagged paragraph with an inline link
// (crosshair on text, pointer on the anchor), a search block (form
// control branch), and a sibling page so the "edit mode off" assertion
// has a real URL to land on with the same shape.
$homeContent = "<!-- wp:paragraph -->\n"
	. "<p>Cursor rule paragraph with an <a href=\"/about/\">inline link</a> inside.</p>\n"
	. "<!-- /wp:paragraph -->\n\n"
	. "<!-- wp:search {\"label\":\"Search\",\"buttonText\":\"Go\"} /-->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Cursor Rule Home',
	'post_content' => $homeContent,
]);

wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'About',
	'post_content' => "<!-- wp:heading --><h2 class=\"wp-block-heading\">About page reached.</h2><!-- /wp:heading -->\n",
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
