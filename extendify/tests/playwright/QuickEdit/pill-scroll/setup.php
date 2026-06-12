<?php
require '/wordpress/wp-load.php';

// Seed a homepage taller than the viewport so wheel events have somewhere
// to scroll. One tagged paragraph near the top brings the pill bar into
// reach; ten filler paragraphs push the body height past one screen.
$filler = str_repeat(
    "<!-- wp:paragraph -->\n<p>Filler paragraph for vertical scroll room.</p>\n<!-- /wp:paragraph -->\n\n",
    10
);

$homeContent = "<!-- wp:paragraph -->\n"
    . "<p>Tagged paragraph the pill bar attaches to.</p>\n"
    . "<!-- /wp:paragraph -->\n\n"
    . $filler;

$pageId = wp_insert_post([
    'post_type'    => 'page',
    'post_status'  => 'publish',
    'post_title'   => 'QE Pill Scroll Home',
    'post_content' => $homeContent,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
