<?php
/**
 * The Sanitizer class
 */

namespace Extendify\Shared\Services;

defined('ABSPATH') || die('No direct access.');

/**
 * Class for sanitizing various data types.
 */
class Sanitizer
{
    /**
     * This function will sanitize a value.
     *
     * @param mixed $data - The data we need to sanitize.
     * @return array|string
     */
    public static function sanitizeUnknown($data)
    {
        return is_array($data) ? self::sanitizeArray($data) : self::sanitizeText($data);
    }
    /**
     * This function will sanitize a multidimensional array.
     *
     * @param array $array - The array we need to sanitize.
     * @return array
     */
    public static function sanitizeArray($array)
    {
        $sanitizedArray = [];
        foreach ($array as $key => $value) {
            $sanitizedArray[$key] = is_array($value) ? self::sanitizeArray($value) : \sanitize_text_field($value);
        }

        return $sanitizedArray;
    }

    /**
     * This function will sanitize the user selections.
     *
     * @param array $array - The array we need to sanitize.
     * @return array
     */
    public static function sanitizeUserSelections($array)
    {
        $sanitizedArray = [];
        foreach ($array as $key => $value) {
            $sanitizedArray[$key] = is_array($value) ? self::sanitizeUserSelections($value) : self::sanitizePostContent($value);
        }

        return $sanitizedArray;
    }

    /**
     * This function will sanitize a text field.
     *
     * @param string $text - The string we need to sanitize.
     * @return string
     */
    public static function sanitizeText($text)
    {
        return \sanitize_text_field($text);
    }

    /**
     * This function will sanitize a textarea field.
     *
     * @param string $text - The strings we need to sanitize.
     * @return string
     */
    public static function sanitizeTextarea($text)
    {
        return \sanitize_textarea_field($text);
    }

    /**
     * This function will sanitize the post content.
     *
     * @param string $content - The post content we need to sanitize.
     * @return string
     */
    public static function sanitizePostContent($content)
    {
        return \wp_kses_post($content);
    }
}
