<?php

namespace Extendify\Tests\Integration\QuickEdit\Controllers;

use Extendify\QuickEdit\Controllers\WPFormsController;
use WP_UnitTestCase;

class WPFormsControllerTest extends WP_UnitTestCase
{
    public function setUp(): void
    {
        parent::setUp();
        if (!defined('EXTENDIFY_REQUIRED_CAPABILITY')) {
            define('EXTENDIFY_REQUIRED_CAPABILITY', 'manage_options');
        }
        // Mirror WPForms' production CPT registration (class-form.php) so
        // any code that checks edit_post against a wpforms post fails here
        // exactly the way it fails on a real site — map_meta_cap=false means
        // edit_post resolves to the primitive cap edit_wpforms_form, which
        // admins don't hold via core. A bare register_post_type('wpforms')
        // silently grants admins edit_post and hides the regression.
        register_post_type('wpforms', [
            'capability_type' => 'wpforms_form',
            'map_meta_cap'    => false,
            'supports'        => ['title', 'author', 'revisions'],
        ]);
        $this->loginAsAdmin();
    }

    public function test_permission_callback_requires_admin_capability()
    {
        wp_set_current_user(0);
        $this->assertFalse(WPFormsController::permissionCallback());

        $sub = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($sub);
        $this->assertFalse(WPFormsController::permissionCallback());

        $editor = self::factory()->user->create(['role' => 'editor']);
        wp_set_current_user($editor);
        $this->assertFalse(WPFormsController::permissionCallback());

        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
        $this->assertTrue(WPFormsController::permissionCallback());
    }

    public function test_get_without_form_id_returns_400()
    {
        $res = WPFormsController::handleGet($this->getRequest([]));
        $this->assertSame(400, $res->get_status());
        $this->assertSame('form_id + field_id required', $res->get_data()['error']);
    }

    public function test_get_with_missing_field_id_returns_400()
    {
        $res = WPFormsController::handleGet($this->getRequest(['form_id' => 1]));
        $this->assertSame(400, $res->get_status());
    }

    public function test_get_with_non_wpforms_post_returns_404()
    {
        $postId = self::factory()->post->create();

        $res = WPFormsController::handleGet($this->getRequest([
            'form_id'  => $postId,
            'field_id' => 1,
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('wpforms form not found', $res->get_data()['error']);
    }

    public function test_get_with_unparseable_form_json_returns_404()
    {
        $formId = $this->createForm('not valid json');

        $res = WPFormsController::handleGet($this->getRequest([
            'form_id'  => $formId,
            'field_id' => 1,
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('wpforms form content is not valid JSON', $res->get_data()['error']);
    }

    public function test_get_missing_field_returns_404()
    {
        $formId = $this->createForm(wp_json_encode(['fields' => []]));

        $res = WPFormsController::handleGet($this->getRequest([
            'form_id'  => $formId,
            'field_id' => 7,
        ]));

        $this->assertSame(404, $res->get_status());
        $this->assertSame('field not found', $res->get_data()['error']);
    }

    public function test_get_returns_four_editable_props_for_a_field()
    {
        $formId = $this->createForm(wp_json_encode([
            'fields' => [
                3 => [
                    'id'          => 3,
                    'type'        => 'text',
                    'label'       => 'Your Name',
                    'placeholder' => 'Enter name',
                    'description' => 'Required field',
                    'required'    => '1',
                    // Extra props must be ignored by GET.
                    'choices'           => [['label' => 'a']],
                    'conditional_logic' => ['x' => 'y'],
                    'default_value'     => 'foo',
                ],
            ],
        ]));

        $res = WPFormsController::handleGet($this->getRequest([
            'form_id'  => $formId,
            'field_id' => 3,
        ]));

        $this->assertSame(200, $res->get_status());
        $data = $res->get_data();
        $this->assertSame([
            'id', 'type', 'label', 'placeholder', 'required', 'description',
        ], array_keys($data));
        $this->assertSame(3, $data['id']);
        $this->assertSame('text', $data['type']);
        $this->assertSame('Your Name', $data['label']);
        $this->assertSame('Enter name', $data['placeholder']);
        $this->assertTrue($data['required']);
        $this->assertSame('Required field', $data['description']);
    }

    public function test_get_decodes_required_truthy_strings_and_falsy()
    {
        $formId = $this->createForm(wp_json_encode([
            'fields' => [
                1 => ['id' => 1, 'required' => ''],
                2 => ['id' => 2, 'required' => 'yes'],
                3 => ['id' => 3, 'required' => true],
            ],
        ]));

        $this->assertFalse($this->getField($formId, 1)->get_data()['required']);
        $this->assertTrue($this->getField($formId, 2)->get_data()['required']);
        $this->assertTrue($this->getField($formId, 3)->get_data()['required']);
    }

    public function test_post_requires_form_id_field_id_and_changes()
    {
        $res = WPFormsController::handlePost($this->postRequest([
            'form_id'  => 1,
            'field_id' => 1,
        ]));

        $this->assertSame(400, $res->get_status());
        $this->assertSame('form_id, field_id, changes required', $res->get_data()['error']);
    }

    public function test_post_updates_label_placeholder_description_required()
    {
        $formId = $this->createForm(wp_json_encode([
            'fields' => [
                5 => [
                    'id'          => 5,
                    'type'        => 'text',
                    'label'       => 'Old',
                    'placeholder' => 'old',
                    'description' => 'old',
                    'required'    => '',
                ],
            ],
        ]));

        $res = WPFormsController::handlePost($this->postRequest([
            'form_id'  => $formId,
            'field_id' => 5,
            'changes'  => [
                'label'       => 'New Label',
                'placeholder' => 'new',
                'description' => '<strong>desc</strong>',
                'required'    => true,
            ],
        ]));

        $this->assertSame(200, $res->get_status());
        $field = $this->reloadField($formId, 5);
        $this->assertSame('New Label', $field['label']);
        $this->assertSame('new', $field['placeholder']);
        $this->assertSame('<strong>desc</strong>', $field['description']);
        // existing required was a string ⇒ preserve string shape.
        $this->assertSame('1', $field['required']);
    }

    public function test_post_required_preserves_bool_shape_when_existing_was_bool()
    {
        $formId = $this->createForm(wp_json_encode([
            'fields' => [1 => ['id' => 1, 'required' => false]],
        ]));

        WPFormsController::handlePost($this->postRequest([
            'form_id'  => $formId,
            'field_id' => 1,
            'changes'  => ['required' => '1'],
        ]));

        $this->assertSame(true, $this->reloadField($formId, 1)['required']);
    }

    public function test_post_does_not_drop_choices_validation_conditional_logic_defaults()
    {
        $formId = $this->createForm(wp_json_encode([
            'fields' => [
                2 => [
                    'id'                => 2,
                    'type'              => 'select',
                    'label'             => 'Pick',
                    'choices'           => [['label' => 'A'], ['label' => 'B']],
                    'conditional_logic' => ['enabled' => true],
                    'default_value'     => 'A',
                    'validation'        => ['min' => 1],
                ],
            ],
        ]));

        WPFormsController::handlePost($this->postRequest([
            'form_id'  => $formId,
            'field_id' => 2,
            'changes'  => ['label' => 'Pick One'],
        ]));

        $field = $this->reloadField($formId, 2);
        $this->assertSame('Pick One', $field['label']);
        $this->assertSame([['label' => 'A'], ['label' => 'B']], $field['choices']);
        $this->assertSame(['enabled' => true], $field['conditional_logic']);
        $this->assertSame('A', $field['default_value']);
        $this->assertSame(['min' => 1], $field['validation']);
    }

    public function test_post_with_unknown_change_keys_silently_drops_them()
    {
        $formId = $this->createForm(wp_json_encode([
            'fields' => [1 => ['id' => 1, 'label' => 'L']],
        ]));

        $res = WPFormsController::handlePost($this->postRequest([
            'form_id'  => $formId,
            'field_id' => 1,
            'changes'  => ['bogus' => 'x', 'choices' => [['label' => 'evil']]],
        ]));

        $this->assertSame(200, $res->get_status());
        $field = $this->reloadField($formId, 1);
        $this->assertSame('L', $field['label']);
        $this->assertArrayNotHasKey('bogus', $field);
        $this->assertArrayNotHasKey('choices', $field);
    }

    public function test_post_sanitizes_label_strips_script()
    {
        $formId = $this->createForm(wp_json_encode([
            'fields' => [1 => ['id' => 1, 'label' => '']],
        ]));

        WPFormsController::handlePost($this->postRequest([
            'form_id'  => $formId,
            'field_id' => 1,
            'changes'  => ['label' => '<script>x</script>Hi'],
        ]));

        $this->assertSame('Hi', $this->reloadField($formId, 1)['label']);
    }

    public function test_post_returns_404_for_unknown_field()
    {
        $formId = $this->createForm(wp_json_encode(['fields' => [1 => ['id' => 1]]]));

        $res = WPFormsController::handlePost($this->postRequest([
            'form_id'  => $formId,
            'field_id' => 999,
            'changes'  => ['label' => 'x'],
        ]));

        $this->assertSame(404, $res->get_status());
    }

    public function test_init_hooks_registerRoutes_into_rest_api_init()
    {
        remove_all_filters('rest_api_init');
        WPFormsController::init();

        $this->assertNotFalse(
            has_action('rest_api_init', [WPFormsController::class, 'registerRoutes'])
        );
    }

    private function createForm(string $jsonContent): int
    {
        return self::factory()->post->create([
            'post_type'    => 'wpforms',
            'post_status'  => 'publish',
            'post_content' => wp_slash($jsonContent),
        ]);
    }

    private function getField(int $formId, int $fieldId): \WP_REST_Response
    {
        return WPFormsController::handleGet($this->getRequest([
            'form_id'  => $formId,
            'field_id' => $fieldId,
        ]));
    }

    private function reloadField(int $formId, int $fieldId): array
    {
        $form = json_decode(get_post($formId)->post_content, true);
        return $form['fields'][$fieldId];
    }

    private function getRequest(array $params): \WP_REST_Request
    {
        $req = new \WP_REST_Request('GET', '/extendify/v1/quick-edit/wpforms');
        foreach ($params as $k => $v) {
            $req->set_param($k, $v);
        }
        return $req;
    }

    private function postRequest(array $body): \WP_REST_Request
    {
        $req = new \WP_REST_Request('POST', '/extendify/v1/quick-edit/wpforms');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode($body));
        return $req;
    }

    private function loginAsAdmin(): void
    {
        $admin = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin);
    }
}
