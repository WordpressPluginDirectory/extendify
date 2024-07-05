<?php
/**
 * Image uploader class
 */

namespace Extendify\Shared\Services\Import;

defined('ABSPATH') || die('No direct access.');

/**
 * This class responsible for uploading the image.
 */
class ImageUploader
{
    /**
     * The mime types we support !!
     *
     * @var string[]
     */
    protected $mimes = [
        'image/gif' => '.gif',
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
        'image/x-png' => '.png',
        'image/jp2' => '.jp2',
        'image/jpx' => '.jp2',
        'image/webp' => '.wbmp',
        'image/avif' => '.avif',
    ];

    /**
     * The images domains we use
     *
     * @var string[] the domain names.
     */
    public static $imagesDomains = [
        'unsplash.com',
        'extendify.com',
    ];

    /**
     * Upload the image and return the attachment information
     * If the attachment is already there, then return the
     * attachment information only.
     *
     * @param string      $image  the image url to upload.
     * @param string|null $author the WordPress post author.
     * @return array|\WP_Error
     */
    public function uploadImage($image, $author = null)
    {
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $image = str_replace('format%2Ccompres', 'format,compres', $image);
        // If the attachment has been already uploaded, just return it.
        $attachment = $this->getAttachmentIfExists($image);

        if ($attachment instanceof \WP_Post) {
            return [
                'attachment_id' => $attachment->ID,
                'url' => $attachment->guid,
            ];
        }

        if (!file_is_valid_image($image)) {
            return new \WP_Error(2001, 'File is not a valid image.');
        }

        $imageHeadersInformation = wp_remote_retrieve_headers(wp_safe_remote_head($image));

        if (!empty($imageHeadersInformation)) {
            $headers = $imageHeadersInformation->getAll();
            $fileMimeType = $headers['content-type'];
        } else {
            $fileMimeType = wp_get_image_mime($image);
        }

        if (!array_key_exists($fileMimeType, $this->mimes)) {
            return new \WP_Error(2002, 'File type is not allowed.');
        }

        // Otherwise, upload it.
        $extension = $this->mimes[$fileMimeType];

        // We only upload the images if they are hosted on unsplash.com or extendify.com.
        $imageUrl = (preg_match('(' . implode('|', array_map('preg_quote', self::$imagesDomains)) . ')i', $image)) ? esc_url_raw($image . '&auto=avif,compress&q=70') : esc_url_raw($image);
        $response = wp_remote_get($imageUrl);
        $body = trim(wp_remote_retrieve_body($response));
        $upload = wp_upload_bits(sha1($image) . $extension, null, $body);

        if ($upload['error']) {
            return new \WP_Error(2003, 'There was an error while uploading the image.');
        }

        // Check the size of the file to ensure the file was successfully uploaded.
        // If the size of the uploaded file is 0 we need to delete it.
	      // phpcs:ignore WordPress.PHP.NoSilencedErrors, Generic.PHP.NoSilencedErrors.Discouraged
        if (!@filesize($upload['file']) || !wp_getimagesize($upload['file'])) {
            // No need to keep the file, so we just delete it to be uploaded later.
		        // phpcs:ignore WordPress.PHP.NoSilencedErrors, Generic.PHP.NoSilencedErrors.Discouraged
            @unlink($upload['file']);
            return new \WP_Error(2001, 'File is not a valid image.');
        }

        $attachment = [
            'guid' => $upload['url'],
            'post_mime_type' => $upload['type'],
            'post_title' => sha1($image),
            'post_content' => '',
            'post_status' => 'inherit',
            'post_author' => $author,
        ];

        $attachmentId = wp_insert_attachment($attachment, $upload['file']);

        if (is_wp_error($attachmentId) || !$attachmentId) {
            return new \WP_Error(2004, 'There was an error while adding the attachment record in the database.');
        }

        wp_update_attachment_metadata($attachmentId, wp_generate_attachment_metadata($attachmentId, $upload['file']));

        $upload['attachment_id'] = $attachmentId;

        return $upload;
    }

    /**
     * Check if the image has been already uploaded or not, if yes
     * then return the attachment information.
     *
     * @param string $image the image url we need to check for.
     * @return array|\WP_Post|null
     */
    protected function getAttachmentIfExists($image)
    {
        $postId = attachment_url_to_postid($image);
        if ($postId) {
            return get_post($postId);
        }

        $attachment = get_posts([
            'post_type' => 'attachment',
            'numberposts' => 1,
            's' => sha1($image),
            'post_status' => 'inherit',
            'post_mime_type' => implode(',', array_keys($this->mimes)),
        ]);

        return $attachment ? $attachment[0] : [];
    }
}
