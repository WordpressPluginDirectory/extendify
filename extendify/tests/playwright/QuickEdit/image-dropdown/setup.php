<?php
require '/wordpress/wp-load.php';

$imageBlock = "<!-- wp:image {\"width\":\"160px\",\"height\":\"160px\"} -->\n"
	. '<figure class="wp-block-image is-resized"><img src="https://s.w.org/style/images/about/WordPress-logotype-wmark.png" alt="WordPress mark" style="width:160px;height:160px;object-fit:contain" /></figure>'
	. "\n<!-- /wp:image -->\n";

$spacer = "<!-- wp:spacer {\"height\":\"40px\"} -->\n"
	. '<div style="height:40px" aria-hidden="true" class="wp-block-spacer"></div>'
	. "\n<!-- /wp:spacer -->\n";

$paragraph = "<!-- wp:paragraph -->\n"
	. '<p>A paragraph above the images for the cross-block click test.</p>'
	. "\n<!-- /wp:paragraph -->\n";

$content = $paragraph . $spacer . $imageBlock . $spacer . $imageBlock;

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Image Dropdown Orphan',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
