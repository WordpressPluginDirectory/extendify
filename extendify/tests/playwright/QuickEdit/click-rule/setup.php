<?php
require '/wordpress/wp-load.php';

// Click-rule seed: a tagged paragraph with an inline link (anchor
// branch), a plain tagged paragraph (select branch), a search input (form-
// control focus branch), and a second page so the navigate + edit-mode
// persistence assertion has a real URL to land on.
wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'About',
	'post_content' => "<!-- wp:heading --><h2 class=\"wp-block-heading\">About page reached.</h2><!-- /wp:heading -->\n",
]);

$homeContent = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Click rule home.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p>This paragraph has an <a href=\"/about/\">inline About link</a> mid-sentence.</p>\n"
	. "<!-- /wp:paragraph -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p>A second paragraph with no link, plain text to click on.</p>\n"
	. "<!-- /wp:paragraph -->\n\n"
	. "<!-- wp:group {\"layout\":{\"type\":\"constrained\"}} -->\n"
	. "<div class=\"wp-block-group\"><!-- wp:paragraph -->\n"
	. "<p>Inside the Ask-AI-only group.</p>\n"
	. "<!-- /wp:paragraph --></div>\n"
	. "<!-- /wp:group -->\n\n"
	. "<!-- wp:search {\"label\":\"Search\",\"buttonText\":\"Go\"} /-->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Click Rule Home',
	'post_content' => $homeContent,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
