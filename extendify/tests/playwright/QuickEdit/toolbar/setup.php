<?php
require '/wordpress/wp-load.php';

$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">A heading where toolbar tooltips can be hovered for a while.</h2>\n"
	. "<!-- /wp:heading -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Toolbar Tooltip Test Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
