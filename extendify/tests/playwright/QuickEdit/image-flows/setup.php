<?php
require '/wordpress/wp-load.php';

// One core/image block — the picker dropdown anchors to it. URL-only (no
// attachment id) is acceptable; Image schema's apply() handles the no-id
// path so /quick-edit/save doesn't validate the URL points at a real
// media item. The placeholder URL is a known wp.org-served asset so the
// initial GET doesn't 404 in the browser before the test mocks land.
$content = "<!-- wp:image -->\n"
	. '<figure class="wp-block-image"><img src="https://s.w.org/style/images/about/WordPress-logotype-wmark.png" alt="WordPress mark" /></figure>'
	. "\n<!-- /wp:image -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Image Flows Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
