<?php
require '/wordpress/wp-load.php';

// One heading (for the Save 5xx + agent-cannot-toggle pins) and one
// core/image block (for the AI host down pin). resolveTarget maps
// `wp-block-heading` → `core/heading` cleanly, which keeps the Quick
// Edit pill reachable; paragraphs at the same scope would only surface
// Ask AI today and wouldn't open BlockTextEditor.
$content = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Edge contracts heading.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:image -->\n"
	. '<figure class="wp-block-image"><img src="https://s.w.org/style/images/about/WordPress-logotype-wmark.png" alt="WordPress mark" /></figure>'
	. "\n<!-- /wp:image -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Edge Contracts Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
