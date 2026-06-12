<?php
require '/wordpress/wp-load.php';

// Ref-based navigation: the items live in a wp_navigation CPT post.
// PHPUnit tests already pin WPNavigationController end to end.
// The matching E2E flow needs the navigation block inside a *template-part*
// (not page content) so resolveTarget routes through PART_ATTR →
// wp-navigation source: a nav block embedded in post_content takes the
// POST_ATTR branch and hits SaveController, which 409s on the outer
// navigation block (parsed core/navigation has empty innerBlocks for
// ref-based navs, since items live in a separate wp_navigation post).
// Three items so item-index counts past zero and reorder/delete cases
// have something to walk.
$navContent = '<!-- wp:navigation-link {"label":"Original Home","url":"/"} /-->'
	. "\n"
	. '<!-- wp:navigation-link {"label":"Original About","url":"/about"} /-->'
	. "\n"
	. '<!-- wp:navigation-link {"label":"Original Contact","url":"/contact"} /-->';

$navPostId = wp_insert_post([
	'post_type'    => 'wp_navigation',
	'post_status'  => 'publish',
	'post_title'   => 'QE Test Nav',
	'post_content' => $navContent,
]);

$content = "<!-- wp:heading -->\n"
	. '<h2 class="wp-block-heading">QE reload-flows home.</h2>'
	. "\n<!-- /wp:heading -->";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE Reload Flows Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);

// Seed a 1x1 PNG attachment + point site_logo at it so the front-page
// site-logo block has something to render — extendable hides
// `.wp-block-site-logo:empty` via CSS, and an unset `site_logo` option
// renders nothing, so without this the block isn't hoverable. The
// attachment also gives SiteIdentityModal's `logo` kind a populated
// `logo_url` + the Change-logo / Remove button pair the site-logo flow acts on.
$uploadDir = wp_upload_dir();
if (!empty($uploadDir['path']) && !file_exists($uploadDir['path'])) {
	wp_mkdir_p($uploadDir['path']);
}
$logoPath = trailingslashit($uploadDir['path']) . 'qe-reload-flows-logo.png';
file_put_contents(
	$logoPath,
	base64_decode(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII='
	)
);
$logoId = wp_insert_attachment(
	[
		'post_mime_type' => 'image/png',
		'post_title'     => 'QE Reload Flows Logo',
		'post_status'    => 'inherit',
	],
	$logoPath
);
require_once ABSPATH . 'wp-admin/includes/image.php';
wp_update_attachment_metadata(
	$logoId,
	wp_generate_attachment_metadata($logoId, $logoPath)
);
update_option('site_logo', (int) $logoId);

// Override extendable's `header` template-part so all three site-identity
// blocks render side by side on the front page. Block themes prefer a
// DB-resolved wp_template_part over the theme's filesystem part when both
// exist for the same slug + wp_theme term. The base template still invokes
// the part with tagName="header", so the <header> wrapper — and thus
// role="banner" — is preserved for the locators in the spec.
// The {"width":120} attribute renders the logo at 120px regardless of
// the source PNG's intrinsic size — without it the 1x1 seed renders
// 1px tall, the hover bar's transparent ::before bridge above the bar
// overlaps the cursor's resting position, and Playwright's hover gives
// up because the bar "intercepts pointer events".
// The wp:navigation block here is what makes the ref-based save
// path reachable from the front end: TagTemplateParts puts PART_ATTR on
// every block inside the part scope (each <li> nav item included), so
// resolveTarget's PART_ATTR branch fires and routes to findNavContext
// instead of falling through to SaveController. `overlayMenu:"never"`
// keeps the items inline at every viewport so Playwright can hover them
// directly without driving the responsive overlay open first.
$headerContent = "<!-- wp:site-logo {\"width\":120} /-->\n"
	. "<!-- wp:site-title /-->\n"
	. "<!-- wp:site-tagline /-->\n"
	. '<!-- wp:navigation {"ref":' . (int) $navPostId
	. ',"overlayMenu":"never"} /-->';

$headerPartId = wp_insert_post([
	'post_type'    => 'wp_template_part',
	'post_status'  => 'publish',
	'post_name'    => 'header',
	'post_title'   => 'Header',
	'post_content' => $headerContent,
]);
wp_set_object_terms($headerPartId, 'extendable', 'wp_theme');
