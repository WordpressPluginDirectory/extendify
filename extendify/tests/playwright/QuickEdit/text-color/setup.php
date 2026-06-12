<?php
require '/wordpress/wp-load.php';

$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Custom <mark style=\"background-color:#ff66aa\" class=\"has-inline-color\">Made</mark> Wood Tables Crafted to Yes!</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">A plain heading with no pre-existing marks at all.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p>Here is <mark style=\"background-color:#cf2e2e\" class=\"has-inline-color\">some</mark> sample text</p>\n"
	. "<!-- /wp:paragraph -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Text Color Test Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
