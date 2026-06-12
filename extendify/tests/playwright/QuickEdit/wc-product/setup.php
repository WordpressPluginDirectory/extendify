<?php
require '/wordpress/wp-load.php';

// Bypass WC's onboarding tasklist + setup wizard. Spec runs front-end
// only, but the admin redirects can intercept on first visit.
update_option('woocommerce_admin_install_timestamp', time());
update_option('woocommerce_task_list_hidden', 'yes');
update_option('woocommerce_extended_task_list_hidden', 'yes');

$uploadDir = wp_upload_dir();
if (!empty($uploadDir['path']) && !file_exists($uploadDir['path'])) {
	wp_mkdir_p($uploadDir['path']);
}
require_once ABSPATH . 'wp-admin/includes/image.php';

$pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

$primaryPath = trailingslashit($uploadDir['path']) . 'qe-wc-product.png';
file_put_contents($primaryPath, base64_decode($pngBase64));
$primaryImgId = wp_insert_attachment(
	[
		'post_mime_type' => 'image/png',
		'post_title'     => 'QE WC Product Primary',
		'post_status'    => 'inherit',
	],
	$primaryPath
);
wp_update_attachment_metadata(
	$primaryImgId,
	wp_generate_attachment_metadata($primaryImgId, $primaryPath)
);

// Second image so the image-picker swap test has a distinct target.
$altPath = trailingslashit($uploadDir['path']) . 'qe-wc-product-alt.png';
file_put_contents($altPath, base64_decode($pngBase64));
$altImgId = wp_insert_attachment(
	[
		'post_mime_type' => 'image/png',
		'post_title'     => 'QE WC Product Alt',
		'post_status'    => 'inherit',
	],
	$altPath
);
wp_update_attachment_metadata(
	$altImgId,
	wp_generate_attachment_metadata($altImgId, $altPath)
);

// Seed one WC product covering every field WCProductTagger maps:
// name (post_title), short_description (post_excerpt), regular + sale
// price (postmeta via the product object so derived _price stays in
// sync), and featured image (post thumbnail).
$productId = wp_insert_post([
	'post_type'    => 'product',
	'post_status'  => 'publish',
	'post_title'   => 'Original Product Name',
	'post_excerpt' => 'Original short description.',
	'post_content' => 'Long description content.',
]);
set_post_thumbnail($productId, $primaryImgId);

if (function_exists('wc_get_product')) {
	$product = wc_get_product($productId);
	if ($product) {
		$product->set_regular_price('30');
		$product->set_sale_price('20');
		$product->set_price('20');
		$product->save();
	}
}

// Front page: a core/query loop scoped to the seeded product so its
// postId context flows into the inner blocks (post-title, post-excerpt,
// product-price, product-image). WCProductTagger reads
// blockObj->context['postId'] from each — a regular page sidesteps any
// extendable + WC single-product template resolution differences and
// keeps the rendered DOM predictable across WC + wp-playground boots.
$content = '<!-- wp:query {"query":{"perPage":1,"postType":"product","postIn":[' . (int) $productId . ']}} -->'
	. "\n<div class=\"wp-block-query\">"
	. "\n<!-- wp:post-template -->"
	. "\n<!-- wp:post-title {\"isLink\":false} /-->"
	. "\n<!-- wp:post-excerpt /-->"
	. "\n<!-- wp:woocommerce/product-price /-->"
	. "\n<!-- wp:woocommerce/product-image /-->"
	. "\n<!-- /wp:post-template -->"
	. "\n</div>"
	. "\n<!-- /wp:query -->";

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE WC Product Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);

update_option('extendify_qe_test_product_id', (int) $productId);
update_option('extendify_qe_test_primary_image_id', (int) $primaryImgId);
update_option('extendify_qe_test_alt_image_id', (int) $altImgId);
