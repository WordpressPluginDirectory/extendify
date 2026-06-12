<?php
require '/wordpress/wp-load.php';

$content = "<!-- wp:paragraph -->\n"
	. "<p>A plain paragraph that can take a text alignment.</p>\n"
	. "<!-- /wp:paragraph -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">A heading that can take a text alignment.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:buttons -->\n"
	. "<div class=\"wp-block-buttons\"><!-- wp:button -->\n"
	. "<div class=\"wp-block-button\"><a class=\"wp-block-button__link wp-element-button\" href=\"#\">Browse Collection</a></div>\n"
	. "<!-- /wp:button --></div>\n"
	. "<!-- /wp:buttons -->\n\n"
	. "<!-- wp:image -->\n"
	. "<figure class=\"wp-block-image\"><img src=\"https://images-resource.extendify.com/test.jpg\" alt=\"\"/></figure>\n"
	. "<!-- /wp:image -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Text Alignment Test Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
