<?php
require '/wordpress/wp-load.php';

// Auto-save-on-implicit-close seed. Three quick-editable headings: A + B
// drive the cross-block gesture (edit A, click B → A auto-saves and QE
// opens on B), C drives the click-outside gesture (edit C, click the
// footer → C auto-saves and the canvas tears down). Headings get both
// pills and open QE on click, so the spec never has to touch a pill.
$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Heading A for cross-block auto-save.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Heading B is the cross-block target.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Heading C for click-outside auto-save.</h2>\n"
	. "<!-- /wp:heading -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Auto-Save Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
