<?php
require '/wordpress/wp-load.php';

// The button + phone CTAs live in a *template part* (the header), not page
// content, so Quick Edit routes through the template-part load + save path
// (resolveTarget's PART_ATTR branch → TemplatePartBlockFinder) rather than the
// post path. The phone is a core/paragraph whose entire text is a single tel:
// link — the target of the save-time href sync and the link-activation on open.
// Block themes prefer a DB-resolved wp_template_part over the theme's
// filesystem part for the same slug + wp_theme term; the base template still
// invokes it with tagName="header", so role="banner" is preserved for locators.
$headerContent = "<!-- wp:site-title /-->\n"
	. "<!-- wp:paragraph -->\n"
	. '<p><a href="tel:0123456789">01 23 45 67 89</a></p>' . "\n"
	. "<!-- /wp:paragraph -->\n"
	. "<!-- wp:buttons -->\n"
	. "<div class=\"wp-block-buttons\">\n"
	. "<!-- wp:button -->\n"
	. '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://example.com/desks">Shop Desks</a></div>' . "\n"
	. "<!-- /wp:button -->\n"
	. "</div>\n"
	. "<!-- /wp:buttons -->";

$headerPartId = wp_insert_post([
	'post_type'    => 'wp_template_part',
	'post_status'  => 'publish',
	'post_name'    => 'header',
	'post_title'   => 'Header',
	'post_content' => $headerContent,
]);
wp_set_object_terms($headerPartId, 'extendable', 'wp_theme');

// A static front page so `/` is stable. Its content is irrelevant — the CTAs
// under test live in the header part, which renders on every template (so the
// default "Hello world!" post at /?p=1 is the site-wide cross-check).
$frontId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'Header CTA Home',
	'post_content' => "<!-- wp:heading -->\n"
		. '<h2 class="wp-block-heading">Header CTA home.</h2>'
		. "\n<!-- /wp:heading -->",
]);
update_option('show_on_front', 'page');
update_option('page_on_front', $frontId);
