<?php
require '/wordpress/wp-load.php';

$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Esc target heading.</h2>\n"
	. "<!-- /wp:heading -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Agent Esc Clears Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
