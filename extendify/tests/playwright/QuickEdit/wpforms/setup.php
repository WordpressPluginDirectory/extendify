<?php
require '/wordpress/wp-load.php';

// Minimal two-field form: a text field exercised by the spec, and a
// select field whose choices the controller must NOT clobber on
// label-only saves. WPForms stores the form post_content as JSON; the
// post id and the form's internal `id` must match (WPForms renders by
// post id + reads attributes by internal id).
$formId = wp_insert_post([
	'post_type'    => 'wpforms',
	'post_status'  => 'publish',
	'post_title'   => 'QE Test Form',
	'post_content' => '',
]);

$formJson = [
	'id'       => (string) $formId,
	'field_id' => '5',
	'fields'   => [
		'1' => [
			'id'          => '1',
			'type'        => 'text',
			'label'       => 'Original Name Label',
			'placeholder' => 'Original placeholder',
			'description' => 'Original description',
			'required'    => '1',
			'size'        => 'medium',
		],
		'2' => [
			'id'      => '2',
			'type'    => 'select',
			'label'   => 'Preferred contact',
			'choices' => [
				'1' => ['label' => 'Email', 'value' => 'email'],
				'2' => ['label' => 'Phone', 'value' => 'phone'],
			],
			'size'    => 'medium',
		],
	],
	'settings' => [
		'form_title'              => 'QE Test Form',
		'form_desc'               => '',
		'submit_text'             => 'Submit',
		'submit_text_processing'  => 'Sending…',
	],
];

wp_update_post([
	'ID'           => $formId,
	'post_content' => wp_slash(wp_json_encode($formJson)),
]);

$content = "<!-- wp:heading -->\n"
	. '<h2 class="wp-block-heading">QE WPForms home.</h2>'
	. "\n<!-- /wp:heading -->\n\n"
	. '<!-- wp:wpforms/form-selector {"formId":"' . (int) $formId . '"} /-->';

$pageId = wp_insert_post([
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_title'   => 'QE WPForms Home',
	'post_content' => $content,
]);

update_option('show_on_front', 'page');
update_option('page_on_front', $pageId);

// Surface the form post id to the spec without an extra REST call. The
// form-selector block embeds it in the rendered <form id> attribute,
// but pinning it as a meta-tag keeps the assertion robust against
// WPForms version changes.
update_option('extendify_qe_test_form_id', (int) $formId);
