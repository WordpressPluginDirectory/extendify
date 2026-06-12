<?php
require '/wordpress/wp-load.php';

// Two distinct blocks so the cross-session flash repro (click A → cancel →
// click B) has two different identities to compare. Heading text + paragraph
// text deliberately diverge so a stale-singleton flash would surface heading
// A's content inside the paragraph B canvas.
$homeContent = "<!-- wp:heading -->\n"
	. "<h2 class=\"wp-block-heading\">Heading aardvark first session.</h2>\n"
	. "<!-- /wp:heading -->\n\n"
	. "<!-- wp:paragraph -->\n"
	. "<p>Paragraph beluga second session.</p>\n"
	. "<!-- /wp:paragraph -->\n";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Canvas Mount Home',
	'post_content' => $homeContent,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
