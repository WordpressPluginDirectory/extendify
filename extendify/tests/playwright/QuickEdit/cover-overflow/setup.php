<?php
require '/wordpress/wp-load.php';

// Two cover blocks back-to-back so a single page exercises both branches of
// findOpaqueBackground's cover-handling path:
//
// 1. Image-only cover (dim-0, no overlay color) — the `__background` span has
//    `has-background-dim-0` → CSS opacity 0. The fix's fallback kicks in:
//    host gets `rgba(0, 0, 0, 0.5)`.
//
// 2. Cover with an opaque overlay span (dim-90, overlayColor: background) —
//    the span resolves to rgb(255,255,255) at opacity 0.9. The fix reads it
//    and emits host `rgba(255, 255, 255, 0.9)`.
//
// findOpaqueBackground doesn't look at the cover image, so a 1×1 transparent
// gif data URI is enough for the image-only cover to have its <img>.
$tinyImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

$content =
    "<!-- wp:cover {\"url\":\"$tinyImage\",\"dimRatio\":0,\"isUserOverlayColor\":true,\"minHeight\":260,\"minHeightUnit\":\"px\"} -->\n"
    . "<div class=\"wp-block-cover\" style=\"min-height:260px\"><span aria-hidden=\"true\" class=\"wp-block-cover__background has-background-dim-0 has-background-dim\"></span><img class=\"wp-block-cover__image-background\" alt=\"\" src=\"$tinyImage\" data-object-fit=\"cover\"/><div class=\"wp-block-cover__inner-container\">"
    . "<!-- wp:heading {\"level\":2,\"className\":\"image-only-heading\"} -->\n"
    . "<h2 class=\"wp-block-heading image-only-heading\">Image only heading</h2>\n"
    . "<!-- /wp:heading -->\n"
    . "</div></div>\n"
    . "<!-- /wp:cover -->\n"

    . "<!-- wp:cover {\"dimRatio\":90,\"overlayColor\":\"background\",\"isUserOverlayColor\":true,\"minHeight\":260,\"minHeightUnit\":\"px\"} -->\n"
    . "<div class=\"wp-block-cover\" style=\"min-height:260px\"><span aria-hidden=\"true\" class=\"wp-block-cover__background has-background-background-color has-background-dim-90 has-background-dim\"></span><div class=\"wp-block-cover__inner-container\">"
    . "<!-- wp:heading {\"level\":2,\"className\":\"overlay-heading\"} -->\n"
    . "<h2 class=\"wp-block-heading overlay-heading\">Overlay heading</h2>\n"
    . "<!-- /wp:heading -->\n"
    . "</div></div>\n"
    . "<!-- /wp:cover -->\n";

$pageId = wp_insert_post([
    'post_type'    => 'page',
    'post_status'  => 'publish',
    'post_title'   => 'Cover Overflow Test Home',
    'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);
