<?php
require '/wordpress/wp-load.php';

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Toolbar Test Home',
	'post_content' => '<!-- wp:paragraph --><p>Toolbar test page.</p><!-- /wp:paragraph -->',
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
