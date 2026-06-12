<?php
require '/wordpress/wp-load.php';

// One tagged block is enough — the QE bundle only mounts (and only then
// repositions the admin-bar toggle) when the page has taggable targets.
$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Heading for the topbar order spec.</h2>\n"
	. "<!-- /wp:heading -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Topbar Toggle Order Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
